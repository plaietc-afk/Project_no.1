import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import db from '../db';

interface ModelEntry {
  provider: string;
  model: string;
  prompt_per_1k: number;
  completion_per_1k: number;
}
interface ModelClass {
  class: string;
  display_name: string;
  models: ModelEntry[];
}
interface PricingConfig {
  model_classes: ModelClass[];
}

let _pricingCache: PricingConfig | null = null;
function loadPricingConfig(): PricingConfig {
  if (_pricingCache) return _pricingCache;
  const filePath = path.resolve(__dirname, '../data/model-pricing.json');
  try {
    _pricingCache = JSON.parse(fs.readFileSync(filePath, 'utf8')) as PricingConfig;
    return _pricingCache;
  } catch {
    throw new Error('Pricing configuration unavailable');
  }
}

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

// Returns optional user_id filter clause — accepts ?user_id= query param for per-user filtering.
// NOTE: This is an open-access self-hosted tool; any caller can filter by any user_id.
// Network-level protection is assumed. Validate the value is a safe positive integer.
function userScope(req: Request): { clause: string; params: unknown[] } {
  const raw = parseInt(req.query.user_id as string, 10);
  const userId = Number.isInteger(raw) && raw > 0 ? raw : null;
  if (userId) return { clause: 'AND user_id = ?', params: [userId] };
  return { clause: '', params: [] };
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

// GET /api/stats/by-user?days=30
router.get('/by-user', (req: Request, res: Response) => {
  const { from, to } = dateRange(req);

  const rows = db.prepare(`
    SELECT u.id AS user_id, COALESCE(u.display_name, u.full_name, u.email) AS display_name,
      COALESCE(SUM(tl.total_tokens), 0) AS total_tokens,
      COALESCE(SUM(tl.cost_usd), 0)     AS total_cost_usd,
      COUNT(tl.id)                        AS total_requests
    FROM users u
    LEFT JOIN token_logs tl ON tl.user_id = u.id
      AND date(tl.created_at) BETWEEN date(?) AND date(?)
    GROUP BY u.id ORDER BY total_cost_usd DESC
  `).all(from, to);

  return res.json({ success: true, data: rows });
});

// GET /api/stats/latency?days=30
router.get('/latency', (req: Request, res: Response) => {
  const { from, to } = dateRange(req);
  const { clause, params } = userScope(req);

  const rows = db.prepare(`
    SELECT provider, latency_ms
    FROM token_logs
    WHERE latency_ms > 0 AND date(created_at) BETWEEN date(?) AND date(?) ${clause}
    ORDER BY provider, latency_ms
  `).all(from, to, ...params) as Array<{ provider: string; latency_ms: number }>;

  // Group by provider and compute P50/P95/avg
  const byProvider = new Map<string, number[]>();
  for (const row of rows) {
    const arr = byProvider.get(row.provider) ?? [];
    arr.push(row.latency_ms);
    byProvider.set(row.provider, arr);
  }

  const data = Array.from(byProvider.entries()).map(([provider, values]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const avg = Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length);
    return { provider, p50_ms: p50, p95_ms: p95, avg_ms: avg, request_count: sorted.length };
  }).sort((a, b) => a.p50_ms - b.p50_ms);

  return res.json({ success: true, data });
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

// GET /api/stats/cost-comparison/classes
router.get('/cost-comparison/classes', (_req: Request, res: Response) => {
  const config = loadPricingConfig();
  const classes = config.model_classes.map(c => ({ class: c.class, display_name: c.display_name }));
  return res.json({ success: true, data: classes });
});

// GET /api/stats/cost-comparison?prompt_tokens=N&completion_tokens=N&model_class=standard
router.get('/cost-comparison', (req: Request, res: Response) => {
  const promptTokens = Math.max(0, parseInt(req.query.prompt_tokens as string) || 1_000_000);
  const completionTokens = Math.max(0, parseInt(req.query.completion_tokens as string) || 300_000);
  const modelClass = (req.query.model_class as string) || 'standard';

  const config = loadPricingConfig();
  const cls = config.model_classes.find(c => c.class === modelClass);
  if (!cls) {
    return res.status(400).json({ success: false, error: `Unknown model class: ${modelClass}` });
  }

  const results = cls.models.map(m => {
    const promptCost = (promptTokens / 1000) * m.prompt_per_1k;
    const completionCost = (completionTokens / 1000) * m.completion_per_1k;
    return {
      provider: m.provider,
      model: m.model,
      prompt_cost_usd: promptCost,
      completion_cost_usd: completionCost,
      total_cost_usd: promptCost + completionCost,
      prompt_per_1k: m.prompt_per_1k,
      completion_per_1k: m.completion_per_1k
    };
  }).sort((a, b) => a.total_cost_usd - b.total_cost_usd);

  return res.json({ success: true, data: results, meta: { prompt_tokens: promptTokens, completion_tokens: completionTokens, model_class: modelClass } });
});

export default router;
