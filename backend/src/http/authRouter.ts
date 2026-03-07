import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from '../services/authService';
import { requireAuth, type AuthRequest } from '../auth/middleware';
import { findUserById } from '../repositories/userRepository';
import { parseBody } from './validation';

const router = Router();

const authPayloadSchema = z.object({
  email: z.string().email('Invalid email').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

router.post('/register', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = parseBody(authPayloadSchema, req.body);
    const result = await authService.register(email, password);
    res.status(201).json(result);
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
    res.json(result);
  } catch (e) {
    if ((e as Error).message === 'Invalid email or password') {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    next(e);
  }
});

router.post('/logout', (_req: Request, res: Response): void => {
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
