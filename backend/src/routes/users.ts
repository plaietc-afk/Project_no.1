import { Router, Request, Response } from 'express';
import { z } from 'zod';
import db from '../db';

const router = Router();

const CreateUserSchema = z.object({
  display_name: z.string().min(1).max(100).trim()
});

const UpdateUserSchema = z.object({
  display_name: z.string().min(1).max(100).trim()
});

interface UserRow {
  id: number;
  display_name: string | null;
  full_name: string | null;
  email: string;
  role: string;
  created_at: string;
}

function formatUser(row: UserRow) {
  return {
    id: row.id,
    display_name: row.display_name ?? row.full_name ?? row.email,
    role: row.role,
    created_at: row.created_at
  };
}

// GET /api/users — list all users
router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare(
    'SELECT id, display_name, full_name, email, role, created_at FROM users ORDER BY created_at ASC'
  ).all() as UserRow[];
  return res.json({ success: true, data: rows.map(formatUser) });
});

// POST /api/users — create a named user
router.post('/', (req: Request, res: Response) => {
  const parsed = CreateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
  }
  const { display_name } = parsed.data;
  // Use a placeholder email derived from display_name to satisfy UNIQUE NOT NULL constraint
  const slug = display_name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40);
  const email = `${slug}-${Date.now()}@local`;
  const result = db.prepare(
    "INSERT INTO users (email, password_hash, display_name, full_name, role, package_id) VALUES (?, '', ?, ?, 'user', 3)"
  ).run(email, display_name, display_name);
  const row = db.prepare(
    'SELECT id, display_name, full_name, email, role, created_at FROM users WHERE id = ?'
  ).get(result.lastInsertRowid) as UserRow;
  return res.status(201).json({ success: true, data: formatUser(row) });
});

// PUT /api/users/:id — rename a user
router.put('/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: 'User not found' });

  const parsed = UpdateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
  }
  db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(parsed.data.display_name, req.params.id);
  const updated = db.prepare(
    'SELECT id, display_name, full_name, email, role, created_at FROM users WHERE id = ?'
  ).get(req.params.id) as UserRow;
  return res.json({ success: true, data: formatUser(updated) });
});

// DELETE /api/users/:id — delete a user (only if they have no keys)
router.delete('/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: 'User not found' });
  const keyCount = (db.prepare('SELECT COUNT(*) as c FROM api_keys WHERE user_id = ? AND is_active = 1').get(req.params.id) as { c: number }).c;
  if (keyCount > 0) {
    return res.status(409).json({ success: false, error: 'Cannot delete user with active API keys. Revoke their keys first.' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  return res.json({ success: true, message: 'User deleted' });
});

export default router;
