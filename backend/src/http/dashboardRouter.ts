import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireCsrf, type AuthRequest } from '../auth/middleware';
import { parseQuery, dateStringSchema } from './validation';
import * as dashboardService from '../services/dashboardService';
import * as activityChartService from '../services/activityChartService';
import * as netWorthService from '../services/netWorthService';

const router = Router();
const asOfQuerySchema = z.object({ asOf: dateStringSchema.optional() });
const activityQuerySchema = z.object({ period: z.enum(['6m', '12m', 'all']).default('12m') });
const netWorthQuerySchema = z.object({ months: z.coerce.number().int().min(0).max(60).default(12) });

router.use(requireAuth);
router.use(requireCsrf);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { asOf } = parseQuery(asOfQuerySchema, req.query);
    res.json(await dashboardService.getMainDashboard(req.userId, asOf));
  } catch (error) {
    next(error);
  }
});

router.get('/activity-chart', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { period } = parseQuery(activityQuerySchema, req.query);
    res.json(await activityChartService.getMainActivityChart(req.userId, period));
  } catch (error) {
    next(error);
  }
});

router.get('/net-worth', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { months } = parseQuery(netWorthQuerySchema, req.query);
    res.json(await netWorthService.getNetWorth(req.userId, months));
  } catch (error) {
    next(error);
  }
});

export default router;
