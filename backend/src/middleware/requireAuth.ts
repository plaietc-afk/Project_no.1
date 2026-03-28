import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db';

export interface AuthUser {
  id: number;
  email: string;
  role: string;
  package_id: number;
  full_name: string | null;
  tokens_used: number;
  usd_spent: number;
  usage_reset_at: string | null;
  is_active: number;
}

declare global {
  namespace Express {
    interface Request {
      currentUser?: AuthUser;
    }
  }
}

function extractToken(req: Request): string | null {
  // 1. Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  // 2. httpOnly cookie
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/access_token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required', code: 'UNAUTHENTICATED' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) return res.status(500).json({ success: false, error: 'Server misconfiguration' });

  try {
    const payload = jwt.verify(token, secret) as { userId: number };
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(payload.userId) as AuthUser | undefined;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found or deactivated', code: 'UNAUTHENTICATED' });
    }
    req.currentUser = user;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token', code: 'TOKEN_INVALID' });
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.currentUser) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  if (req.currentUser.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
};

export const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) return next();

  const secret = process.env.JWT_SECRET;
  if (!secret) return next();

  try {
    const payload = jwt.verify(token, secret) as { userId: number };
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(payload.userId) as AuthUser | undefined;
    if (user) req.currentUser = user;
  } catch { /* ignore */ }
  next();
};
