import { Router, Response, NextFunction, Request } from 'express';
import multer from 'multer';
import { z } from 'zod';
import * as cardService from '../services/cardService';
import * as purchaseService from '../services/purchaseService';
import * as depositService from '../services/depositService';
import * as planService from '../services/planService';
import * as dashboardService from '../services/dashboardService';
import * as activityChartService from '../services/activityChartService';
import * as importExportService from '../services/importExportService';
import * as reconciliationService from '../services/reconciliationService';
import * as statementImportService from '../services/statementImportService';
import { StatementParseError } from '../services/statementParser';
import { requireAuth, requireCsrf, type AuthRequest } from '../auth/middleware';
import { parseBody, parseQuery, dateStringSchema } from './validation';
import { HttpError } from './errorMiddleware';

const router = Router({ mergeParams: true });

const cardCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  reportDay: z.coerce.number().int().min(1).max(31),
  graceModel: z.enum(['legacy_months', 'statement_periods', 'ozon_anchor']).optional(),
  gracePeriods: z.coerce.number().int().min(1).max(36).optional(),
  graceDueDay: z.coerce.number().int().min(1).max(31).optional(),
  graceStatementPeriods: z.coerce.number().int().min(1).max(12).optional(),
  paymentDueOffsetDays: z.coerce.number().int().min(0).max(31).optional(),
});

const cardSettingsSchema = z
  .object({
    reportDay: z.coerce.number().int().min(1).max(31).optional(),
    graceModel: z.enum(['legacy_months', 'statement_periods', 'ozon_anchor']).optional(),
    gracePeriods: z.coerce.number().int().min(1).max(36).optional(),
    graceDueDay: z.coerce.number().int().min(1).max(31).optional(),
    graceStatementPeriods: z.coerce.number().int().min(1).max(12).optional(),
    paymentDueOffsetDays: z.coerce.number().int().min(0).max(31).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'At least one field is required');

const asOfQuerySchema = z.object({
  asOf: dateStringSchema.optional(),
});

const rangeQuerySchema = z.object({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
});

const activityChartQuerySchema = z.object({
  period: z.enum(['6m', '12m', 'all']).default('12m'),
});

const purchaseSchema = z.object({
  purchaseDate: dateStringSchema,
  amount: z.coerce.number().positive(),
  description: z.string().trim().max(512).optional(),
});

const depositSchema = z.object({
  depositDate: dateStringSchema,
  amount: z.coerce.number().positive(),
});

const reconciliationSchema = z.object({
  reconciliationDate: dateStringSchema.refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Date must be a valid calendar date'),
  actualDebt: z.coerce.number().finite().min(0),
});

const statementImportSchema = z.object({
  selectedFingerprints: z.string().transform((value, context) => {
    try {
      const parsed: unknown = JSON.parse(value);
      if (!Array.isArray(parsed) || parsed.length > 5000 || parsed.some((item) => typeof item !== 'string')) {
        context.addIssue({ code: 'custom', message: 'selectedFingerprints must be a JSON string array' });
        return z.NEVER;
      }
      return parsed as string[];
    } catch {
      context.addIssue({ code: 'custom', message: 'selectedFingerprints must be valid JSON' });
      return z.NEVER;
    }
  }),
  reconcile: z.enum(['true', 'false']).transform((value) => value === 'true'),
});

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1, fields: 3, parts: 4 },
  fileFilter: (_req, file, callback) => {
    const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      callback(new HttpError(400, 'Загрузите PDF-файл'));
      return;
    }
    callback(null, true);
  },
}).single('file');

function uploadStatement(req: Request, res: Response, next: NextFunction): void {
  pdfUpload(req, res, (error) => {
    if (error) {
      next(error instanceof HttpError ? error : new HttpError(400, 'PDF слишком большой или имеет неверный формат'));
      return;
    }
    next();
  });
}

router.use(requireAuth);
router.use(requireCsrf);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cards = await cardService.listCards(req.userId!);
    res.json(cards);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      name,
      reportDay,
      graceModel,
      gracePeriods,
      graceDueDay,
      graceStatementPeriods,
      paymentDueOffsetDays,
    } = parseBody(
      cardCreateSchema,
      req.body
    );
    const card = await cardService.createCardUseCase(req.userId!, {
      name,
      reportDay,
      graceModel,
      gracePeriods,
      graceDueDay,
      graceStatementPeriods,
      paymentDueOffsetDays,
    });
    res.status(201).json(card);
  } catch (e) {
    next(e);
  }
});

router.get('/:cardId', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const card = await cardService.getCard(req.params.cardId, req.userId);
    if (!card) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    res.json(card);
  } catch (e) {
    next(e);
  }
});

router.patch('/:cardId/settings', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = parseBody(cardSettingsSchema, req.body);
    const card = await cardService.patchCardSettings(
      req.params.cardId,
      payload,
      req.userId
    );
    if (!card) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    res.json(card);
  } catch (e) {
    next(e);
  }
});

router.get('/:cardId/buckets', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { asOf } = parseQuery(asOfQuerySchema, req.query);
    const effectiveAsOf = asOf || new Date().toISOString().slice(0, 10);
    const buckets = await cardService.getBucketsForCard(
      req.params.cardId,
      new Date(effectiveAsOf),
      req.userId
    );
    if (buckets === null) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    res.json(
      buckets.map((b) => ({
        ...b,
        dueDate: b.dueDate.toISOString().slice(0, 10),
      }))
    );
  } catch (e) {
    next(e);
  }
});

router.get('/:cardId/plan', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { asOf } = parseQuery(asOfQuerySchema, req.query);
    const plan = await planService.getPlan(
      req.params.cardId,
      asOf,
      req.userId
    );
    if (plan === null) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    res.json(plan);
  } catch (e) {
    next(e);
  }
});

router.get('/:cardId/dashboard', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { asOf } = parseQuery(asOfQuerySchema, req.query);
    const dashboard = await dashboardService.getDashboard(
      req.params.cardId,
      asOf,
      req.userId
    );
    if (dashboard === null) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    res.json(dashboard);
  } catch (e) {
    next(e);
  }
});

router.get('/:cardId/activity-chart', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { period } = parseQuery(activityChartQuerySchema, req.query);
    const chart = await activityChartService.getActivityChart(req.params.cardId, period, req.userId);
    if (chart === null) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    res.json(chart);
  } catch (e) {
    next(e);
  }
});

router.get('/:cardId/export', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = await importExportService.exportCardData(
      req.params.cardId,
      req.userId!
    );
    if (!payload) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    res.json(payload);
  } catch (e) {
    next(e);
  }
});

router.post('/:cardId/import', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await importExportService.importIntoCard(
      req.params.cardId,
      req.body,
      req.userId!
    );
    if (!result) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: 'Invalid import payload' });
  }
});

router.post('/:cardId/statements/preview', uploadStatement, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'PDF-файл обязателен' });
      return;
    }
    const preview = await statementImportService.previewStatement(
      req.params.cardId,
      req.userId!,
      req.file
    );
    if (!preview) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    res.json(preview);
  } catch (error) {
    if (error instanceof StatementParseError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.post('/:cardId/statements/import', uploadStatement, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'PDF-файл обязателен' });
      return;
    }
    const { selectedFingerprints, reconcile } = parseBody(statementImportSchema, req.body);
    const result = await statementImportService.importStatement(
      req.params.cardId,
      req.userId!,
      req.file,
      selectedFingerprints,
      reconcile
    );
    if (!result) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof StatementParseError || (error instanceof Error && (error.message.startsWith('Выбранная') || error.message.startsWith('Список')))) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof reconciliationService.ReconciliationDateError) {
      res.status(409).json({
        error: error.message,
        firstAllowedDate: error.firstAllowedDate,
        lastAllowedDate: error.lastAllowedDate,
      });
      return;
    }
    next(error);
  }
});

router.get('/:cardId/statements', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const imports = await statementImportService.getStatementImports(req.params.cardId, req.userId!);
    if (!imports) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    res.json(imports);
  } catch (error) {
    next(error);
  }
});

router.post('/:cardId/purchases', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { purchaseDate, amount, description } = parseBody(purchaseSchema, req.body);
    const purchase = await purchaseService.addPurchase(
      req.params.cardId,
      {
        purchaseDate,
        amount,
        description,
      },
      req.userId
    );
    res.status(201).json(purchase);
  } catch (e) {
    if ((e as Error).message === 'Card not found') {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    next(e);
  }
});

router.get('/:cardId/purchases', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { from, to } = parseQuery(rangeQuerySchema, req.query);
    const purchases = await purchaseService.getPurchases(
      req.params.cardId,
      from,
      to,
      req.userId
    );
    res.json(purchases);
  } catch (e) {
    next(e);
  }
});

router.post('/:cardId/deposits', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { depositDate, amount } = parseBody(depositSchema, req.body);
    const deposit = await depositService.addDeposit(
      req.params.cardId,
      {
        depositDate,
        amount,
      },
      req.userId
    );
    res.status(201).json(deposit);
  } catch (e) {
    if ((e as Error).message === 'Card not found') {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    next(e);
  }
});

router.post('/:cardId/reconciliations', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = parseBody(reconciliationSchema, req.body);
    const reconciliation = await reconciliationService.reconcileBalance(req.params.cardId, payload, req.userId!);
    res.status(201).json(reconciliation);
  } catch (e) {
    if ((e as Error).message === 'Card not found') {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    if (e instanceof reconciliationService.ReconciliationDateError) {
      res.status(409).json({
        error: e.message,
        firstAllowedDate: e.firstAllowedDate,
        lastAllowedDate: e.lastAllowedDate,
      });
      return;
    }
    next(e);
  }
});

router.get('/:cardId/reconciliations', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reconciliations = await reconciliationService.getReconciliations(req.params.cardId, req.userId!);
    if (!reconciliations) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    res.json(reconciliations);
  } catch (e) {
    next(e);
  }
});

router.get('/:cardId/deposits', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { from, to } = parseQuery(rangeQuerySchema, req.query);
    const deposits = await depositService.getDeposits(
      req.params.cardId,
      from,
      to,
      req.userId
    );
    res.json(deposits);
  } catch (e) {
    next(e);
  }
});

export default router;
