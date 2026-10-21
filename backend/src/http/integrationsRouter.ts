import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireCsrf, type AuthRequest } from '../auth/middleware';
import { parseBody } from './validation';
import * as tinvestService from '../services/tinvestService';

const router = Router();

const tokenSchema = z.object({ token: z.string().trim().min(10).max(256).regex(/^\S+$/) });

router.use(requireAuth);
router.use(requireCsrf);

router.get('/tinvest', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.json(await tinvestService.getStatus(req.userId!));
  } catch (error) {
    next(error);
  }
});

router.put('/tinvest', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token } = parseBody(tokenSchema, req.body);
    await tinvestService.connect(req.userId!, token);
    res.json(await tinvestService.getStatus(req.userId!));
  } catch (error) {
    if (error instanceof tinvestService.TinvestTokenError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.delete('/tinvest', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await tinvestService.disconnect(req.userId!);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/tinvest/accounts/:externalId', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!/^\d{1,64}$/.test(req.params.externalId)) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    const account = await tinvestService.linkAccount(req.userId!, req.params.externalId);
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    res.status(201).json(account);
  } catch (error) {
    next(error);
  }
});

router.post('/tinvest/sync', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.json(await tinvestService.sync(req.userId!));
  } catch (error) {
    next(error);
  }
});

export default router;
