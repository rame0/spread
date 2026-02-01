import { Router, Response } from 'express';
import * as cardService from '../services/cardService';
import * as purchaseService from '../services/purchaseService';
import * as depositService from '../services/depositService';
import * as planService from '../services/planService';
import * as dashboardService from '../services/dashboardService';
import * as importExportService from '../services/importExportService';
import { requireAuth, type AuthRequest } from '../auth/middleware';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cards = await cardService.listCards(req.userId!);
    res.json(cards);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, reportDay, gracePeriods, graceDueDay } = req.body;
    if (!name || reportDay == null) {
      res.status(400).json({ error: 'name and reportDay required' });
      return;
    }
    const card = await cardService.createCardUseCase(req.userId!, {
      name,
      reportDay: Number(reportDay),
      gracePeriods: gracePeriods != null ? Number(gracePeriods) : 4,
      graceDueDay: graceDueDay != null ? Number(graceDueDay) : Number(reportDay),
    });
    res.status(201).json(card);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get('/:cardId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const card = await cardService.getCard(req.params.cardId, req.userId);
    if (!card) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    res.json(card);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.patch('/:cardId/settings', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const card = await cardService.patchCardSettings(
      req.params.cardId,
      req.body,
      req.userId
    );
    if (!card) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    res.json(card);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get('/:cardId/buckets', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const asOf =
      (req.query.asOf as string) || new Date().toISOString().slice(0, 10);
    const buckets = await cardService.getBucketsForCard(
      req.params.cardId,
      new Date(asOf),
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
    res.status(500).json({ error: String(e) });
  }
});

router.get('/:cardId/plan', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const asOf = req.query.asOf as string | undefined;
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
    res.status(500).json({ error: String(e) });
  }
});

router.get('/:cardId/dashboard', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const asOf = req.query.asOf as string | undefined;
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
    res.status(500).json({ error: String(e) });
  }
});

router.get('/:cardId/export', async (req: AuthRequest, res: Response): Promise<void> => {
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
    res.status(500).json({ error: String(e) });
  }
});

router.post('/:cardId/import', async (req: AuthRequest, res: Response): Promise<void> => {
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
    res.status(400).json({ error: String(e) });
  }
});

router.post('/:cardId/purchases', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { purchaseDate, amount, description } = req.body;
    if (!purchaseDate || amount == null) {
      res.status(400).json({ error: 'purchaseDate and amount required' });
      return;
    }
    const purchase = await purchaseService.addPurchase(
      req.params.cardId,
      {
        purchaseDate,
        amount: Number(amount),
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
    res.status(500).json({ error: String(e) });
  }
});

router.get('/:cardId/purchases', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const purchases = await purchaseService.getPurchases(
      req.params.cardId,
      from,
      to,
      req.userId
    );
    res.json(purchases);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/:cardId/deposits', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { depositDate, amount } = req.body;
    if (!depositDate || amount == null) {
      res.status(400).json({ error: 'depositDate and amount required' });
      return;
    }
    const deposit = await depositService.addDeposit(
      req.params.cardId,
      {
        depositDate,
        amount: Number(amount),
      },
      req.userId
    );
    res.status(201).json(deposit);
  } catch (e) {
    if ((e as Error).message === 'Card not found') {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    res.status(500).json({ error: String(e) });
  }
});

router.get('/:cardId/deposits', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const deposits = await depositService.getDeposits(
      req.params.cardId,
      from,
      to,
      req.userId
    );
    res.json(deposits);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
