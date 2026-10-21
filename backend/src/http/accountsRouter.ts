import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireCsrf, type AuthRequest } from '../auth/middleware';
import { parseBody, parseQuery, dateStringSchema } from './validation';
import * as accountService from '../services/accountService';
import * as savingsService from '../services/savingsService';
import { getInterestTax } from '../services/interestTaxService';

const router = Router();

const calendarDateSchema = dateStringSchema.refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, 'Date must be a valid calendar date');

const amountSchema = z.coerce.number().finite().min(-1e13).max(1e13);

const accountFields = {
  name: z.string().trim().min(1).max(255),
  kind: z.enum(['cash', 'debit', 'savings', 'deposit', 'brokerage', 'property', 'other']),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  institution: z.string().trim().max(255).nullable().optional(),
  isLiquid: z.boolean(),
  archivedAt: calendarDateSchema.nullable().optional(),
  interestMode: z.enum(['daily', 'monthly', 'maturity']).nullable().optional(),
  payoutDay: z.coerce.number().int().min(1).max(31).nullable().optional(),
  maturityDate: calendarDateSchema.nullable().optional(),
};

const accountCreateSchema = z.object({
  ...accountFields,
  currency: accountFields.currency.default('RUB'),
  initialBalance: z.object({ date: calendarDateSchema, amount: amountSchema }).optional(),
});

const accountPatchSchema = z
  .object(accountFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

const balanceSchema = z.object({
  amount: amountSchema,
  note: z.string().trim().max(512).nullable().optional(),
});

const noteSchema = z.string().trim().max(512).nullable().optional();
const eventSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.enum(['top_up', 'withdrawal']), eventDate: calendarDateSchema, amount: z.coerce.number().finite().positive().max(1e13), note: noteSchema }),
  z.object({ kind: z.literal('rate_change'), eventDate: calendarDateSchema, rate: z.coerce.number().finite().min(0).max(100), note: noteSchema }),
]);

router.use(requireAuth);
router.use(requireCsrf);

const uuidSchema = z.string().uuid();
router.param('accountId', (_req, res, next, value) => {
  if (!uuidSchema.safeParse(value).success) {
    res.status(404).json({ error: 'Account not found' });
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
router.param('balanceDate', (_req, res, next, value) => {
  if (!calendarDateSchema.safeParse(value).success) {
    res.status(404).json({ error: 'Balance not found' });
    return;
  }
  next();
});

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.json(await accountService.listAccounts(req.userId!));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = parseBody(accountCreateSchema, req.body);
    res.status(201).json(await accountService.addAccount(req.userId!, data));
  } catch (error) {
    next(error);
  }
});

router.get('/interest-tax', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentYear = new Date().getFullYear();
    const { year } = parseQuery(z.object({ year: z.coerce.number().int().min(2000).max(currentYear).default(currentYear) }), req.query);
    res.json(await getInterestTax(req.userId!, year));
  } catch (error) {
    next(error);
  }
});

router.get('/:accountId', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const account = await accountService.getAccount(req.params.accountId, req.userId!);
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    res.json(account);
  } catch (error) {
    next(error);
  }
});

router.patch('/:accountId', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = parseBody(accountPatchSchema, req.body);
    const account = await accountService.patchAccount(req.params.accountId, req.userId!, data);
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    res.json(account);
  } catch (error) {
    next(error);
  }
});

router.delete('/:accountId', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await accountService.removeAccount(req.params.accountId, req.userId!))) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get('/:accountId/balances', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const balances = await accountService.getBalances(req.params.accountId, req.userId!);
    if (!balances) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    res.json(balances);
  } catch (error) {
    next(error);
  }
});

router.put('/:accountId/balances/:balanceDate', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = parseBody(balanceSchema, req.body);
    const balance = await accountService.saveBalance(req.params.accountId, req.userId!, req.params.balanceDate, data);
    if (!balance) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    res.json(balance);
  } catch (error) {
    next(error);
  }
});

router.delete('/:accountId/balances/:balanceDate', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await accountService.removeBalance(req.params.accountId, req.userId!, req.params.balanceDate))) {
      res.status(404).json({ error: 'Balance not found' });
      return;
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get('/:accountId/savings', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const summary = await savingsService.getSavings(req.params.accountId, req.userId!);
    if (!summary) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

router.post('/:accountId/events', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const event = parseBody(eventSchema, req.body);
    const created = await savingsService.addAccountEvent(req.params.accountId, req.userId!, event);
    if (!created) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof savingsService.AccountEventError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.delete('/:accountId/events/:eventId', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await savingsService.removeAccountEvent(req.params.accountId, req.userId!, req.params.eventId))) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
