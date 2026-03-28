import { Router, Request, Response } from 'express';
import { z } from 'zod';
import db from '../db';
import { requireAdmin } from '../middleware/requireAuth';

const router = Router();
router.use(requireAdmin);

// GET /api/admin/users
router.get('/users', (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.created_at,
           u.tokens_used, u.usd_spent, u.usage_reset_at,
           p.name AS package_name, p.display_name AS package_display,
           p.token_quota, p.usd_budget,
           (SELECT COUNT(*) FROM api_keys ak WHERE ak.user_id = u.id AND ak.is_active = 1) AS active_keys
    FROM users u
    LEFT JOIN packages p ON p.id = u.package_id
    ORDER BY u.created_at DESC
  `).all();
  return res.json({ success: true, data: rows });
});

// GET /api/admin/users/:id
router.get('/users/:id', (req: Request, res: Response) => {
  const user = db.prepare(`
    SELECT u.*, p.name AS package_name, p.display_name AS package_display,
           p.token_quota, p.usd_budget, p.rpm_limit, p.allowed_models
    FROM users u LEFT JOIN packages p ON p.id = u.package_id
    WHERE u.id = ?
  `).get(req.params.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  const keys = db.prepare('SELECT id, key_name, provider, is_active, created_at FROM api_keys WHERE user_id = ?').all(req.params.id);
  const recentLogs = db.prepare('SELECT * FROM token_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(req.params.id);

  return res.json({ success: true, data: { user, keys, recent_logs: recentLogs } });
});

// PUT /api/admin/users/:id/package
router.put('/users/:id/package', (req: Request, res: Response) => {
  const schema = z.object({ package_id: z.number().int().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });

  const pkg = db.prepare('SELECT id FROM packages WHERE id = ?').get(parsed.data.package_id);
  if (!pkg) return res.status(404).json({ success: false, error: 'Package not found' });

  db.prepare('UPDATE users SET package_id = ? WHERE id = ?').run(parsed.data.package_id, req.params.id);
  return res.json({ success: true, message: 'Package updated' });
});

// PUT /api/admin/users/:id/activate
router.put('/users/:id/activate', (req: Request, res: Response) => {
  const schema = z.object({ is_active: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'is_active (boolean) required' });
  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(parsed.data.is_active ? 1 : 0, req.params.id);
  return res.json({ success: true });
});

// GET /api/admin/packages
router.get('/packages', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM packages ORDER BY id').all();
  return res.json({ success: true, data: rows });
});

// POST /api/admin/packages
router.post('/packages', (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(1),
    display_name: z.string().min(1),
    token_quota: z.number().int().min(0).default(0),
    usd_budget: z.number().min(0).default(0),
    rpm_limit: z.number().int().min(1).default(10),
    allowed_models: z.array(z.string()).default([]),
    reset_period: z.enum(['monthly', 'never']).default('monthly')
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });

  const d = parsed.data;
  const result = db.prepare(
    `INSERT INTO packages (name, display_name, token_quota, usd_budget, rpm_limit, allowed_models, reset_period)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(d.name, d.display_name, d.token_quota, d.usd_budget, d.rpm_limit, JSON.stringify(d.allowed_models), d.reset_period);

  const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json({ success: true, data: pkg });
});

// PUT /api/admin/packages/:id
router.put('/packages/:id', (req: Request, res: Response) => {
  const schema = z.object({
    display_name: z.string().min(1).optional(),
    token_quota: z.number().int().min(0).optional(),
    usd_budget: z.number().min(0).optional(),
    rpm_limit: z.number().int().min(1).optional(),
    allowed_models: z.array(z.string()).optional(),
    reset_period: z.enum(['monthly', 'never']).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });

  const d = parsed.data;
  const fields: string[] = [];
  const values: unknown[] = [];
  if (d.display_name !== undefined) { fields.push('display_name = ?'); values.push(d.display_name); }
  if (d.token_quota !== undefined) { fields.push('token_quota = ?'); values.push(d.token_quota); }
  if (d.usd_budget !== undefined) { fields.push('usd_budget = ?'); values.push(d.usd_budget); }
  if (d.rpm_limit !== undefined) { fields.push('rpm_limit = ?'); values.push(d.rpm_limit); }
  if (d.allowed_models !== undefined) { fields.push('allowed_models = ?'); values.push(JSON.stringify(d.allowed_models)); }
  if (d.reset_period !== undefined) { fields.push('reset_period = ?'); values.push(d.reset_period); }
  if (!fields.length) return res.status(400).json({ success: false, error: 'No fields to update' });

  values.push(req.params.id);
  db.prepare(`UPDATE packages SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return res.json({ success: true, data: db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id) });
});

// GET /api/admin/stats — global usage
router.get('/stats', (_req: Request, res: Response) => {
  const overview = db.prepare(`
    SELECT COALESCE(SUM(total_tokens),0) AS total_tokens,
           COALESCE(SUM(cost_usd),0) AS total_cost_usd,
           COUNT(*) AS total_requests,
           COUNT(DISTINCT user_id) AS active_users
    FROM token_logs WHERE date(created_at) >= date('now', '-30 days')
  `).get();

  const byPackage = db.prepare(`
    SELECT p.display_name, COUNT(u.id) AS user_count,
           COALESCE(SUM(u.tokens_used),0) AS tokens_used,
           COALESCE(SUM(u.usd_spent),0) AS usd_spent
    FROM packages p LEFT JOIN users u ON u.package_id = p.id
    GROUP BY p.id ORDER BY p.id
  `).all();

  return res.json({ success: true, data: { overview, by_package: byPackage } });
});

export default router;
