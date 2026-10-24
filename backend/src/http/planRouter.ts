import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireCsrf, type AuthRequest } from '../auth/middleware';
import { parseBody, parseQuery, dateStringSchema } from './validation';
import * as planItemService from '../services/planItemService';
import { getForecast } from '../services/forecastService';
import * as planSuggestionService from '../services/planSuggestionService';

const router = Router();

const calendarDateSchema = dateStringSchema.refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, 'Date must be a valid calendar date');

const itemFields = {
  name: z.string().trim().min(1).max(255),
  kind: z.enum(['income', 'expense', 'transfer']),
  amount: z.coerce.number().finite().positive().max(1e13),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  frequency: z.enum(['once', 'weekly', 'monthly', 'yearly']),
  interval: z.coerce.number().int().min(1).max(120),
  startDate: calendarDateSchema,
  endDate: calendarDateSchema.nullable().optional(),
  spread: z.boolean(),
  cardId: z.string().uuid().nullable().optional(),
  targetAccountId: z.string().uuid().nullable().optional(),
  note: z.string().trim().max(512).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  sourcePattern: z.string().max(512).nullable().optional(),
};

const itemCreateSchema = z
  .object({ ...itemFields, currency: itemFields.currency.default('RUB'), interval: itemFields.interval.default(1), spread: itemFields.spread.default(false) })
  .refine((value) => !value.endDate || value.endDate >= value.startDate, 'End date must not be before the start date');

const itemPatchSchema = z
  .object(itemFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

const forecastQuerySchema = z.object({ months: z.coerce.number().int().min(3).max(24).default(12) });
const dismissSchema = z.object({ key: z.string().min(1).max(600), amount: z.coerce.number().finite().min(0).max(1e13) });
const categoryMonthQuerySchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });

router.use(requireAuth);
router.use(requireCsrf);

const uuidSchema = z.string().uuid();
router.param('itemId', (_req, res, next, value) => {
  if (!uuidSchema.safeParse(value).success) {
    res.status(404).json({ error: 'Plan item not found' });
    return;
  }
  next();
});

router.get('/items', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.json(await planItemService.listPlanItems(req.userId!));
  } catch (error) {
    next(error);
  }
});

router.post('/items', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = parseBody(itemCreateSchema, req.body);
    res.status(201).json(await planItemService.addPlanItem(req.userId!, data));
  } catch (error) {
    if (error instanceof planItemService.PlanItemError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.patch('/items/:itemId', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = parseBody(itemPatchSchema, req.body);
    const item = await planItemService.patchPlanItem(req.userId!, req.params.itemId, data);
    if (!item) {
      res.status(404).json({ error: 'Plan item not found' });
      return;
    }
    res.json(item);
  } catch (error) {
    if (error instanceof planItemService.PlanItemError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.delete('/items/:itemId', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await planItemService.removePlanItem(req.userId!, req.params.itemId))) {
      res.status(404).json({ error: 'Plan item not found' });
      return;
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get('/forecast', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { months } = parseQuery(forecastQuerySchema, req.query);
    res.json(await getForecast(req.userId!, months));
  } catch (error) {
    next(error);
  }
});

router.get('/suggestions', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.json(await planSuggestionService.getPlanSuggestions(req.userId!));
  } catch (error) {
    next(error);
  }
});

router.post('/suggestions/dismiss', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { key, amount } = parseBody(dismissSchema, req.body);
    await planSuggestionService.dismissPlanSuggestion(req.userId!, key, amount);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get('/categories', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { month } = parseQuery(categoryMonthQuerySchema, req.query);
    res.json(await planSuggestionService.getCategoryMonth(req.userId!, month));
  } catch (error) {
    next(error);
  }
});

export default router;
