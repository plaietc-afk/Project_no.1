import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import db from '../db';
import { SUPPORTED_PROVIDERS } from '../providers';

const router = Router();

// --- Validation schemas ---
const CreateKeySchema = z.object({
  key_name: z.string().min(1).max(100),
  provider: z.string().refine(v => SUPPORTED_PROVIDERS.includes(v.toLowerCase()), {
    message: `Provider must be one of: ${SUPPORTED_PROVIDERS.join(', ')}`
  }),
  budget: z.number().min(0).default(0),
  project_id: z.string().optional(),
  webhook_url: z.string().url().optional().or(z.literal('')),
  alert_thresholds: z.array(z.number().min(1).max(100)).default([80, 95]),
  rpm_limit: z.number().int().min(0).default(0),
  tpm_limit: z.number().int().min(0).default(0),
  router_config: z.array(z.object({ provider: z.string(), model: z.string() })).optional()
});

const UpdateKeySchema = CreateKeySchema.partial().omit({ key_name: true });

function generateApiKey(prefix: string): { plaintext: string; hash: string } {
  const random = crypto.randomBytes(24).toString('hex');
  const plaintext = `tg-${prefix.slice(0, 8).replace(/[^a-zA-Z0-9]/g, '')}-${random}`;
  const hash = crypto.createHash('sha256').update(plaintext).digest('hex');
  return { plaintext, hash };
}

function safeJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

function formatKey(row: Record<string, unknown>) {
  return {
    id: row.id,
    key_name: row.key_name,
    provider: row.provider,
    budget: row.budget,
    project_id: row.project_id,
    webhook_url: row.webhook_url,
    alert_thresholds: safeJson<number[]>(row.alert_thresholds as string, [80, 95]),
    last_alert_percentage: row.last_alert_percentage,
    rpm_limit: row.rpm_limit,
    tpm_limit: row.tpm_limit,
    is_active: Boolean(row.is_active),
    router_config: safeJson(row.router_config as string, null),
    created_at: row.created_at,
    // Never expose the plaintext key after creation
    key_prefix: typeof row.api_key === 'string' ? row.api_key.slice(0, 12) + '...' : 'tg-...'
  };
}

// POST /api/keys — Create a new key
router.post('/', (req: Request, res: Response) => {
  const parsed = CreateKeySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
  }

  const d = parsed.data;
  const { plaintext, hash } = generateApiKey(d.key_name);
  const userId = req.currentUser?.id ?? null;

  const stmt = db.prepare(`
    INSERT INTO api_keys
      (key_name, api_key, key_hash, provider, budget, project_id, webhook_url,
       alert_thresholds, rpm_limit, tpm_limit, router_config, is_active, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `);

  const result = stmt.run(
    d.key_name,
    plaintext,
    hash,
    d.provider.toLowerCase(),
    d.budget,
    d.project_id ?? null,
    d.webhook_url ?? null,
    JSON.stringify(d.alert_thresholds),
    d.rpm_limit,
    d.tpm_limit,
    d.router_config ? JSON.stringify(d.router_config) : null,
    userId
  );

  const row = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>;

  // Return plaintext key ONCE — it will never be shown again
  return res.status(201).json({
    success: true,
    data: {
      ...formatKey(row),
      api_key: plaintext  // single exposure
    }
  });
});

// GET /api/keys — List keys (scoped to current user, or all for admin)
router.get('/', (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;
  const isAdmin = req.currentUser?.role === 'admin';
  const userId = req.currentUser?.id;

  const where = isAdmin ? '' : 'WHERE user_id = ?';
  const countParams = isAdmin ? [] : [userId];
  const listParams = isAdmin ? [limit, offset] : [userId, limit, offset];

  const total = (db.prepare(`SELECT COUNT(*) as c FROM api_keys ${where}`).get(...countParams) as { c: number }).c;
  const rows = db.prepare(`SELECT * FROM api_keys ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...listParams) as Record<string, unknown>[];

  return res.json({
    success: true,
    data: rows.map(formatKey),
    meta: { total, page, limit, pages: Math.ceil(total / limit) }
  });
});

// GET /api/keys/:id — Get single key (scoped)
router.get('/:id', (req: Request, res: Response) => {
  const isAdmin = req.currentUser?.role === 'admin';
  const where = isAdmin ? 'WHERE id = ?' : 'WHERE id = ? AND user_id = ?';
  const params = isAdmin ? [req.params.id] : [req.params.id, req.currentUser?.id];
  const row = db.prepare(`SELECT * FROM api_keys ${where}`).get(...params) as Record<string, unknown> | undefined;
  if (!row) return res.status(404).json({ success: false, error: 'Key not found' });
  return res.json({ success: true, data: formatKey(row) });
});

// PUT /api/keys/:id — Update key settings (scoped)
router.put('/:id', (req: Request, res: Response) => {
  const isAdmin = req.currentUser?.role === 'admin';
  const where = isAdmin ? 'WHERE id = ?' : 'WHERE id = ? AND user_id = ?';
  const params = isAdmin ? [req.params.id] : [req.params.id, req.currentUser?.id];
  const existing = db.prepare(`SELECT * FROM api_keys ${where}`).get(...params) as Record<string, unknown> | undefined;
  if (!existing) return res.status(404).json({ success: false, error: 'Key not found' });

  const parsed = UpdateKeySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
  }

  const d = parsed.data;
  const fields: string[] = [];
  const values: unknown[] = [];

  if (d.provider !== undefined) { fields.push('provider = ?'); values.push(d.provider.toLowerCase()); }
  if (d.budget !== undefined) { fields.push('budget = ?'); values.push(d.budget); }
  if (d.project_id !== undefined) { fields.push('project_id = ?'); values.push(d.project_id); }
  if (d.webhook_url !== undefined) { fields.push('webhook_url = ?'); values.push(d.webhook_url); }
  if (d.alert_thresholds !== undefined) { fields.push('alert_thresholds = ?'); values.push(JSON.stringify(d.alert_thresholds)); }
  if (d.rpm_limit !== undefined) { fields.push('rpm_limit = ?'); values.push(d.rpm_limit); }
  if (d.tpm_limit !== undefined) { fields.push('tpm_limit = ?'); values.push(d.tpm_limit); }
  if (d.router_config !== undefined) { fields.push('router_config = ?'); values.push(JSON.stringify(d.router_config)); }

  if (fields.length === 0) return res.status(400).json({ success: false, error: 'No fields to update' });

  values.push(req.params.id);
  db.prepare(`UPDATE api_keys SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  return res.json({ success: true, data: formatKey(updated) });
});

// DELETE /api/keys/:id — Soft-delete (revoke) a key (scoped)
router.delete('/:id', (req: Request, res: Response) => {
  const isAdmin = req.currentUser?.role === 'admin';
  const where = isAdmin ? 'WHERE id = ?' : 'WHERE id = ? AND user_id = ?';
  const params = isAdmin ? [req.params.id] : [req.params.id, req.currentUser?.id];
  const row = db.prepare(`SELECT id FROM api_keys ${where}`).get(...params);
  if (!row) return res.status(404).json({ success: false, error: 'Key not found' });
  db.prepare('UPDATE api_keys SET is_active = 0 WHERE id = ?').run(req.params.id);
  return res.json({ success: true, message: 'Key revoked' });
});

// POST /api/keys/:id/rotate — Generate a new key secret, invalidate old (scoped)
router.post('/:id/rotate', (req: Request, res: Response) => {
  const isAdmin = req.currentUser?.role === 'admin';
  const where = isAdmin ? 'WHERE id = ?' : 'WHERE id = ? AND user_id = ?';
  const params = isAdmin ? [req.params.id] : [req.params.id, req.currentUser?.id];
  const row = db.prepare(`SELECT * FROM api_keys ${where}`).get(...params) as Record<string, unknown> | undefined;
  if (!row) return res.status(404).json({ success: false, error: 'Key not found' });

  const { plaintext, hash } = generateApiKey(row.key_name as string);
  db.prepare('UPDATE api_keys SET api_key = ?, key_hash = ?, is_active = 1 WHERE id = ?')
    .run(plaintext, hash, req.params.id);

  return res.json({
    success: true,
    message: 'Key rotated. Save the new key — it will not be shown again.',
    api_key: plaintext
  });
});

// POST /api/keys/test-webhook — Fire a test webhook
router.post('/test-webhook', async (req: Request, res: Response) => {
  const { webhook_url } = req.body as { webhook_url?: string };
  if (!webhook_url) return res.status(400).json({ success: false, error: 'webhook_url is required' });

  try {
    const resp = await fetch(webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'TokenGuard test webhook',
        timestamp: new Date().toISOString()
      }),
      signal: AbortSignal.timeout(5000)
    });
    return res.json({ success: true, status: resp.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ success: false, error: `Webhook delivery failed: ${msg}` });
  }
});

export default router;
