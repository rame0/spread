import { Router, Request, Response } from 'express';
import * as authService from '../services/authService';
import { requireAuth, type AuthRequest } from '../auth/middleware';
import { findUserById } from '../repositories/userRepository';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }
    const result = await authService.register(email, password);
    res.status(201).json(result);
  } catch (e) {
    if ((e as Error).message === 'Email already registered') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: String(e) });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }
    const result = await authService.login(email, password);
    res.json(result);
  } catch (e) {
    if ((e as Error).message === 'Invalid email or password') {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    res.status(500).json({ error: String(e) });
  }
});

router.post('/logout', (_req: Request, res: Response) => {
  res.status(200).json({ ok: true });
});

router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await findUserById(req.userId!);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
