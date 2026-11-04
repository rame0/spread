import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireCsrf, type AuthRequest } from '../auth/middleware';
import { parseBody, parseQuery, dateStringSchema } from './validation';
import { describeRulesets, getTaxBenefits, saveTaxYear } from '../services/taxBenefitService';

const router = Router();

// Not coerced: null means "not known" and must not turn into 0.
const amountSchema = z.number().finite().min(0).max(1e13);
const yearSchema = z.coerce.number().int().min(2000).max(2100);

const taxYearSchema = z.object({
  annualIncome: amountSchema.nullable().default(null),
  otherDeductible: amountSchema.default(0),
  refundReceived: amountSchema.nullable().default(null),
});

router.use(requireAuth);
router.use(requireCsrf);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { year } = parseQuery(z.object({ year: yearSchema.default(new Date().getFullYear()) }), req.query);
    res.json(await getTaxBenefits(req.userId!, year));
  } catch (error) {
    next(error);
  }
});

router.get('/rulesets', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { kind, openedAt } = parseQuery(z.object({ kind: z.enum(['pds', 'iis']), openedAt: dateStringSchema }), req.query);
    res.json(describeRulesets(kind, openedAt));
  } catch (error) {
    next(error);
  }
});

router.put('/years/:year', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const year = yearSchema.safeParse(req.params.year);
    if (!year.success) {
      res.status(404).json({ error: 'Year not found' });
      return;
    }
    res.json(await saveTaxYear(req.userId!, year.data, parseBody(taxYearSchema, req.body)));
  } catch (error) {
    next(error);
  }
});

export default router;
