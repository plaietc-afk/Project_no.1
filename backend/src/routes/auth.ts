import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import db from '../db';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

// 10 attempts per 15 minutes per IP for sensitive auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts. Please try again in 15 minutes.', code: 'RATE_LIMIT' }
});

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/'
};

function issueTokens(userId: number) {
  const secret = process.env.JWT_SECRET!;
  const refreshSecret = process.env.JWT_REFRESH_SECRET!;
  const access = jwt.sign({ userId }, secret, { expiresIn: '15m' });
  const refresh = jwt.sign({ userId }, refreshSecret, { expiresIn: '7d' });
  return { access, refresh };
}

function nextMonthlyReset(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

interface PackageRow {
  id: number;
  name: string;
  display_name: string;
  token_quota: number;
  usd_budget: number;
  rpm_limit: number;
  allowed_models: string;
  reset_period: string;
}

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  full_name: string | null;
  role: string;
  package_id: number;
  tokens_used: number;
  usd_spent: number;
  usage_reset_at: string | null;
  is_active: number;
  created_at: string;
}

function formatUser(user: UserRow, pkg: PackageRow | undefined) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    is_active: Boolean(user.is_active),
    created_at: user.created_at,
    usage: {
      tokens_used: user.tokens_used,
      usd_spent: user.usd_spent,
      usage_reset_at: user.usage_reset_at
    },
    package: pkg ? {
      id: pkg.id,
      name: pkg.name,
      display_name: pkg.display_name,
      token_quota: pkg.token_quota,
      usd_budget: pkg.usd_budget,
      rpm_limit: pkg.rpm_limit,
      allowed_models: JSON.parse(pkg.allowed_models || '[]') as string[]
    } : null
  };
}

// POST /auth/register
router.post('/register', authLimiter, async (req: Request, res: Response) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    full_name: z.string().min(1).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
  }
  const { email, password, full_name } = parsed.data;

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ success: false, error: 'Email already registered' });
  }

  const hash = await bcrypt.hash(password, 12);
  const resetAt = nextMonthlyReset();

  const result = db.prepare(
    `INSERT INTO users (email, password_hash, full_name, role, package_id, usage_reset_at)
     VALUES (?, ?, ?, 'user', 1, ?)`
  ).run(email.toLowerCase(), hash, full_name ?? null, resetAt);

  const userId = result.lastInsertRowid as number;

  // Auto-generate personal API key for the new user
  const keyPrefix = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'user';
  const random = crypto.randomBytes(24).toString('hex');
  const plaintext = `tg-${keyPrefix}-${random}`;
  const keyHash = crypto.createHash('sha256').update(plaintext).digest('hex');

  db.prepare(
    `INSERT INTO api_keys (key_name, api_key, key_hash, provider, is_active, user_id)
     VALUES (?, ?, ?, 'openai', 1, ?)`
  ).run(`${full_name ?? email}'s Key`, plaintext, keyHash, userId);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow;
  const pkg = db.prepare('SELECT * FROM packages WHERE id = 1').get() as PackageRow;

  const { access, refresh } = issueTokens(userId);
  res.cookie('access_token', access, { ...COOKIE_OPTS, maxAge: 15 * 60 * 1000 });
  res.cookie('refresh_token', refresh, { ...COOKIE_OPTS, maxAge: 7 * 24 * 60 * 60 * 1000 });

  return res.status(201).json({
    success: true,
    data: {
      user: formatUser(user, pkg),
      api_key: plaintext  // shown once
    }
  });
});

// POST /auth/login
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Invalid email or password' });
  }
  const { email, password } = parsed.data;

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as UserRow | undefined;
  if (!user || !user.is_active) {
    return res.status(401).json({ success: false, error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ success: false, error: 'Invalid email or password' });
  }

  const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(user.package_id) as PackageRow | undefined;

  const { access, refresh } = issueTokens(user.id);
  res.cookie('access_token', access, { ...COOKIE_OPTS, maxAge: 15 * 60 * 1000 });
  res.cookie('refresh_token', refresh, { ...COOKIE_OPTS, maxAge: 7 * 24 * 60 * 60 * 1000 });

  return res.json({ success: true, data: { user: formatUser(user, pkg) } });
});

// POST /auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('access_token', COOKIE_OPTS);
  res.clearCookie('refresh_token', COOKIE_OPTS);
  return res.json({ success: true });
});

// POST /auth/refresh
router.post('/refresh', authLimiter, (req: Request, res: Response) => {
  const cookieHeader = req.headers.cookie ?? '';
  const match = cookieHeader.match(/refresh_token=([^;]+)/);
  const token = match ? decodeURIComponent(match[1]) : null;
  if (!token) return res.status(401).json({ success: false, error: 'No refresh token' });

  const secret = process.env.JWT_SECRET!;
  const refreshSecret = process.env.JWT_REFRESH_SECRET!;
  try {
    const payload = jwt.verify(token, refreshSecret) as { userId: number };
    const { access, refresh } = issueTokens(payload.userId);
    res.cookie('access_token', access, { ...COOKIE_OPTS, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', refresh, { ...COOKIE_OPTS, maxAge: 7 * 24 * 60 * 60 * 1000 });
    return res.json({ success: true });
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
});

// GET /auth/me
router.get('/me', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(user.package_id) as PackageRow | undefined;
  // Re-fetch to get latest usage stats (no password_hash needed here)
  const userFull = db.prepare('SELECT id, email, role, full_name, package_id, tokens_used, usd_spent, usage_reset_at, is_active, created_at FROM users WHERE id = ?').get(user.id) as UserRow;
  return res.json({ success: true, data: formatUser(userFull, pkg) });
});

// PUT /auth/password
router.put('/password', requireAuth, async (req: Request, res: Response) => {
  const schema = z.object({
    current_password: z.string().min(1),
    new_password: z.string().min(8)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.currentUser!.id) as UserRow;
  const valid = await bcrypt.compare(parsed.data.current_password, user.password_hash);
  if (!valid) return res.status(401).json({ success: false, error: 'Current password is incorrect' });

  const newHash = await bcrypt.hash(parsed.data.new_password, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);
  return res.json({ success: true, message: 'Password updated' });
});

export default router;
