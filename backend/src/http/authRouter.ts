import { Router, Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import * as authService from '../services/authService';
import { requireAuth, requireCsrf, type AuthRequest } from '../auth/middleware';
import { findUserById } from '../repositories/userRepository';
import { parseBody } from './validation';
import { config } from '../config/env';

const router = Router();

const authPayloadSchema = z.object({
  email: z.string().email('Invalid email').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

function shouldUseSecureCookies(req: Request): boolean {
  if (config.authCookieSecure !== 'auto') {
    return config.authCookieSecure;
  }

  const forwardedProto = req.header('x-forwarded-proto');
  return req.secure || forwardedProto === 'https';
}

function setAuthCookies(req: Request, res: Response, token: string): string {
  const csrfToken = randomBytes(24).toString('hex');
  const secure = shouldUseSecureCookies(req);

  res.cookie(config.authCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.cookie(config.csrfCookieName, csrfToken, {
    httpOnly: false,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return csrfToken;
}

router.post('/register', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = parseBody(authPayloadSchema, req.body);
    const result = await authService.register(email, password);
    const csrfToken = setAuthCookies(req, res, result.token);
    res.status(201).json({ user: result.user, csrfToken });
  } catch (e) {
    if ((e as Error).message === 'Email already registered') {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    next(e);
  }
});

router.post('/login', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = parseBody(authPayloadSchema, req.body);
    const result = await authService.login(email, password);
    const csrfToken = setAuthCookies(req, res, result.token);
    res.json({ user: result.user, csrfToken });
  } catch (e) {
    if ((e as Error).message === 'Invalid email or password') {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    next(e);
  }
});

router.post('/logout', requireAuth, requireCsrf, (req: Request, res: Response): void => {
  const secure = shouldUseSecureCookies(req);
  res.clearCookie(config.authCookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
  });
  res.clearCookie(config.csrfCookieName, {
    httpOnly: false,
    sameSite: 'lax',
    secure,
    path: '/',
  });
  res.status(200).json({ ok: true });
});

router.get('/me', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await findUserById(req.userId!);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
