import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireCsrf, type AuthRequest } from '../auth/middleware';
import { parseBody, parseQuery, dateStringSchema } from './validation';
import * as mortgageService from '../services/mortgageService';

const router = Router();

const calendarDateSchema = dateStringSchema.refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, 'Date must be a valid calendar date');

const mortgageFields = {
  name: z.string().trim().min(1).max(255),
  principal: z.coerce.number().finite().positive(),
  issueDate: calendarDateSchema,
  annualRate: z.coerce.number().finite().min(0).max(100),
  termMonths: z.coerce.number().int().min(1).max(600),
  paymentDay: z.coerce.number().int().min(1).max(31),
  firstPaymentInterestOnly: z.boolean(),
};

const mortgageCreateSchema = z.object({
  ...mortgageFields,
  firstPaymentInterestOnly: mortgageFields.firstPaymentInterestOnly.default(true),
});

const mortgagePatchSchema = z
  .object(mortgageFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

const moneySchema = z.coerce.number().finite().positive();
const noteSchema = z.string().trim().max(512).optional();

const eventSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('payment'), eventDate: calendarDateSchema, amount: moneySchema, note: noteSchema }),
  z.object({
    kind: z.literal('prepayment'),
    eventDate: calendarDateSchema,
    amount: moneySchema,
    prepaymentMode: z.enum(['reduce_term', 'reduce_payment']),
    note: noteSchema,
  }),
  z.object({ kind: z.literal('rate_change'), eventDate: calendarDateSchema, newRate: z.coerce.number().finite().min(0).max(100), note: noteSchema }),
  z.object({ kind: z.literal('reconciliation'), eventDate: calendarDateSchema, actualBalance: z.coerce.number().finite().min(0), note: noteSchema }),
]);

const asOfQuerySchema = z.object({ asOf: calendarDateSchema.optional() });
const markPaidSchema = z.object({ until: calendarDateSchema });

router.use(requireAuth);
router.use(requireCsrf);

const uuidSchema = z.string().uuid();
router.param('mortgageId', (_req, res, next, value) => {
  if (!uuidSchema.safeParse(value).success) {
    res.status(404).json({ error: 'Mortgage not found' });
    return;
  }
  next();
});
router.param('eventId', (_req, res, next, value) => {
  if (!uuidSchema.safeParse(value).success) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  next();
});

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.json(await mortgageService.listMortgages(req.userId!));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = parseBody(mortgageCreateSchema, req.body);
    res.status(201).json(await mortgageService.addMortgage(req.userId!, data));
  } catch (error) {
    next(error);
  }
});

router.get('/:mortgageId', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const mortgage = await mortgageService.getMortgage(req.params.mortgageId, req.userId!);
    if (!mortgage) {
      res.status(404).json({ error: 'Mortgage not found' });
      return;
    }
    res.json(mortgage);
  } catch (error) {
    next(error);
  }
});

router.patch('/:mortgageId', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = parseBody(mortgagePatchSchema, req.body);
    const mortgage = await mortgageService.patchMortgage(req.params.mortgageId, req.userId!, data);
    if (!mortgage) {
      res.status(404).json({ error: 'Mortgage not found' });
      return;
    }
    res.json(mortgage);
  } catch (error) {
    next(error);
  }
});

router.delete('/:mortgageId', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await mortgageService.removeMortgage(req.params.mortgageId, req.userId!))) {
      res.status(404).json({ error: 'Mortgage not found' });
      return;
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get('/:mortgageId/schedule', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { asOf } = parseQuery(asOfQuerySchema, req.query);
    const result = await mortgageService.getMortgageSchedule(req.params.mortgageId, req.userId!, asOf);
    if (!result) {
      res.status(404).json({ error: 'Mortgage not found' });
      return;
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/:mortgageId/events', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const event = parseBody(eventSchema, req.body);
    const created = await mortgageService.addMortgageEvent(req.params.mortgageId, req.userId!, event);
    if (!created) {
      res.status(404).json({ error: 'Mortgage not found' });
      return;
    }
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof mortgageService.MortgageEventError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.delete('/:mortgageId/events/:eventId', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await mortgageService.removeMortgageEvent(req.params.mortgageId, req.userId!, req.params.eventId))) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/:mortgageId/mark-paid-until', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { until } = parseBody(markPaidSchema, req.body);
    const result = await mortgageService.markPaidUntil(req.params.mortgageId, req.userId!, until);
    if (!result) {
      res.status(404).json({ error: 'Mortgage not found' });
      return;
    }
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
