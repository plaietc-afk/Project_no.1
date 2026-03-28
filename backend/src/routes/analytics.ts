import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

function dateRange(req: Request): { from: string; to: string } {
  const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);
  const days = parseInt(req.query.days as string) || 30;
  const from = (req.query.from as string) || (() => {
    const d = new Date(to);
    d.setDate(d.getDate() - days + 1);
    return d.toISOString().slice(0, 10);
  })();
  return { from, to };
}

// Returns user_id filter clause and params for WHERE injection
function userScope(req: Request): { clause: string; params: unknown[] } {
  const isAdmin = req.currentUser?.role === 'admin';
  if (isAdmin) return { clause: '', params: [] };
  return { clause: 'AND user_id = ?', params: [req.currentUser?.id ?? -1] };
}

// GET /api/stats/overview
router.get('/overview', (req: Request, res: Response) => {
  const { from, to } = dateRange(req);
  const { clause, params } = userScope(req);

  const row = db.prepare(`
    SELECT
      COALESCE(SUM(total_tokens), 0)       AS total_tokens,
      COALESCE(SUM(prompt_tokens), 0)      AS prompt_tokens,
      COALESCE(SUM(completion_tokens), 0)  AS completion_tokens,
      COALESCE(SUM(cost_usd), 0)           AS total_cost_usd,
      COALESCE(SUM(cost_usd_saved), 0)     AS total_cost_saved_usd,
      COUNT(*)                              AS total_requests,
      COALESCE(SUM(is_cached), 0)          AS cached_requests
    FROM token_logs
    WHERE date(created_at) BETWEEN date(?) AND date(?) ${clause}
  `).get(from, to, ...params) as Record<string, number>;

  return res.json({ success: true, data: { ...row, from, to } });
});

// GET /api/stats/by-provider
router.get('/by-provider', (req: Request, res: Response) => {
  const { from, to } = dateRange(req);
  const { clause, params } = userScope(req);

  const rows = db.prepare(`
    SELECT provider,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COALESCE(SUM(cost_usd), 0)     AS total_cost_usd,
      COUNT(*)                        AS total_requests
    FROM token_logs
    WHERE date(created_at) BETWEEN date(?) AND date(?) ${clause}
    GROUP BY provider ORDER BY total_cost_usd DESC
  `).all(from, to, ...params);

  return res.json({ success: true, data: rows });
});

// GET /api/stats/by-model
router.get('/by-model', (req: Request, res: Response) => {
  const { from, to } = dateRange(req);
  const { clause, params } = userScope(req);

  const rows = db.prepare(`
    SELECT model, provider,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COALESCE(SUM(cost_usd), 0)     AS total_cost_usd,
      COUNT(*)                        AS total_requests
    FROM token_logs
    WHERE date(created_at) BETWEEN date(?) AND date(?) ${clause}
    GROUP BY model, provider ORDER BY total_cost_usd DESC LIMIT 50
  `).all(from, to, ...params);

  return res.json({ success: true, data: rows });
});

// GET /api/stats/by-key
router.get('/by-key', (req: Request, res: Response) => {
  const { from, to } = dateRange(req);
  const { clause, params } = userScope(req);

  const rows = db.prepare(`
    SELECT tl.api_key_id, ak.key_name, ak.project_id, ak.provider, ak.budget,
      COALESCE(SUM(tl.total_tokens), 0) AS total_tokens,
      COALESCE(SUM(tl.cost_usd), 0)     AS total_cost_usd,
      COUNT(*)                            AS total_requests
    FROM token_logs tl
    LEFT JOIN api_keys ak ON ak.id = tl.api_key_id
    WHERE date(tl.created_at) BETWEEN date(?) AND date(?) ${clause}
    GROUP BY tl.api_key_id ORDER BY total_cost_usd DESC
  `).all(from, to, ...params);

  return res.json({ success: true, data: rows });
});

// GET /api/stats/daily?days=30
router.get('/daily', (req: Request, res: Response) => {
  const { from, to } = dateRange(req);
  const { clause, params } = userScope(req);

  const rows = db.prepare(`
    SELECT date(created_at) AS date,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COALESCE(SUM(cost_usd), 0)     AS total_cost_usd,
      COUNT(*)                        AS total_requests
    FROM token_logs
    WHERE date(created_at) BETWEEN date(?) AND date(?) ${clause}
    GROUP BY date(created_at) ORDER BY date ASC
  `).all(from, to, ...params) as Array<{ date: string; total_tokens: number; total_cost_usd: number; total_requests: number }>;

  const dataMap = new Map(rows.map(r => [r.date, r]));
  const filled: typeof rows = [];
  const cursor = new Date(from);
  const endDate = new Date(to);
  while (cursor <= endDate) {
    const dateStr = cursor.toISOString().slice(0, 10);
    filled.push(dataMap.get(dateStr) ?? { date: dateStr, total_tokens: 0, total_cost_usd: 0, total_requests: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return res.json({ success: true, data: filled });
});

// GET /api/stats/heatmap?year=2025
router.get('/heatmap', (req: Request, res: Response) => {
  const year = parseInt(req.query.year as string) || new Date().getFullYear();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const { clause, params } = userScope(req);

  const rows = db.prepare(`
    SELECT date(created_at) AS date,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COUNT(*)                        AS total_requests
    FROM token_logs
    WHERE date(created_at) BETWEEN date(?) AND date(?) ${clause}
    GROUP BY date(created_at)
  `).all(from, to, ...params) as Array<{ date: string; total_tokens: number; total_requests: number }>;

  const dataMap = new Map(rows.map(r => [r.date, r]));
  const maxTokens = rows.reduce((m, r) => Math.max(m, r.total_tokens), 0);

  const days: Array<{ date: string; total_tokens: number; total_requests: number; intensity: number }> = [];
  const cursor = new Date(`${year}-01-01`);
  const end = new Date(`${year}-12-31`);
  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const d = dataMap.get(dateStr) ?? { date: dateStr, total_tokens: 0, total_requests: 0 };
    const intensity = maxTokens > 0 ? Math.min(4, Math.ceil((d.total_tokens / maxTokens) * 4)) : 0;
    days.push({ ...d, intensity });
    cursor.setDate(cursor.getDate() + 1);
  }

  return res.json({ success: true, data: { year, days, max_tokens: maxTokens } });
});

// GET /api/stats/logs
router.get('/logs', (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
  const offset = (page - 1) * limit;
  const keyId = req.query.key_id ? parseInt(req.query.key_id as string) : null;
  const { clause, params } = userScope(req);

  const keyFilter = keyId ? 'AND tl.api_key_id = ?' : '';
  const keyParams = keyId ? [keyId] : [];

  const total = (db.prepare(
    `SELECT COUNT(*) as c FROM token_logs tl WHERE 1=1 ${clause} ${keyFilter}`
  ).get(...params, ...keyParams) as { c: number }).c;

  const rows = db.prepare(`
    SELECT tl.*, ak.key_name, ak.project_id FROM token_logs tl
    LEFT JOIN api_keys ak ON ak.id = tl.api_key_id
    WHERE 1=1 ${clause} ${keyFilter}
    ORDER BY tl.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, ...keyParams, limit, offset);

  return res.json({ success: true, data: rows, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
});

export default router;
