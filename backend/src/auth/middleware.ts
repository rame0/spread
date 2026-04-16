import { Request, Response, NextFunction } from 'express';
import { verifyToken } from './jwt';
import { config } from '../config/env';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const bearerToken =
    authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieToken = req.cookies?.[config.authCookieName] as string | undefined;
  const token = bearerToken || cookieToken;

  if (!token) {
    res.status(401).json({ error: 'Authorization required' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  req.userId = payload.userId;
  req.userEmail = payload.email;
  next();
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function requireCsrf(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const expected = req.cookies?.[config.csrfCookieName] as string | undefined;
  const provided = req.header('x-csrf-token');

  if (!expected || !provided || expected !== provided) {
    res.status(403).json({ error: 'Invalid CSRF token' });
    return;
  }

  next();
}
