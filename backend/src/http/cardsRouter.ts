import { Router } from 'express';
import * as cardService from '../services/cardService';
import * as purchaseService from '../services/purchaseService';
import * as depositService from '../services/depositService';
import * as planService from '../services/planService';
import * as dashboardService from '../services/dashboardService';

const router = Router({ mergeParams: true });

router.get('/', async (_req, res) => {
  try {
    const cards = await cardService.listCards();
    res.json(cards);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, reportDay, gracePeriods, graceDueDay } = req.body;
    if (!name || reportDay == null) {
      return res.status(400).json({ error: 'name and reportDay required' });
    }
    const card = await cardService.createCardUseCase({
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

router.get('/:cardId', async (req, res) => {
  try {
    const card = await cardService.getCard(req.params.cardId);
    if (!card) return res.status(404).json({ error: 'Card not found' });
    res.json(card);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.patch('/:cardId/settings', async (req, res) => {
  try {
    const card = await cardService.patchCardSettings(req.params.cardId, req.body);
    if (!card) return res.status(404).json({ error: 'Card not found' });
    res.json(card);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get('/:cardId/buckets', async (req, res) => {
  try {
    const asOf = (req.query.asOf as string) || new Date().toISOString().slice(0, 10);
    const buckets = await cardService.getBucketsForCard(req.params.cardId, new Date(asOf));
    if (buckets === null) return res.status(404).json({ error: 'Card not found' });
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

router.get('/:cardId/plan', async (req, res) => {
  try {
    const asOf = req.query.asOf as string | undefined;
    const plan = await planService.getPlan(req.params.cardId, asOf);
    if (plan === null) return res.status(404).json({ error: 'Card not found' });
    res.json(plan);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get('/:cardId/dashboard', async (req, res) => {
  try {
    const asOf = req.query.asOf as string | undefined;
    const dashboard = await dashboardService.getDashboard(req.params.cardId, asOf);
    if (dashboard === null) return res.status(404).json({ error: 'Card not found' });
    res.json(dashboard);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/:cardId/purchases', async (req, res) => {
  try {
    const { purchaseDate, amount, description } = req.body;
    if (!purchaseDate || amount == null) {
      return res.status(400).json({ error: 'purchaseDate and amount required' });
    }
    const purchase = await purchaseService.addPurchase(req.params.cardId, {
      purchaseDate,
      amount: Number(amount),
      description,
    });
    res.status(201).json(purchase);
  } catch (e) {
    if ((e as Error).message === 'Card not found') {
      return res.status(404).json({ error: 'Card not found' });
    }
    res.status(500).json({ error: String(e) });
  }
});

router.get('/:cardId/purchases', async (req, res) => {
  try {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const purchases = await purchaseService.getPurchases(req.params.cardId, from, to);
    res.json(purchases);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/:cardId/deposits', async (req, res) => {
  try {
    const { depositDate, amount } = req.body;
    if (!depositDate || amount == null) {
      return res.status(400).json({ error: 'depositDate and amount required' });
    }
    const deposit = await depositService.addDeposit(req.params.cardId, {
      depositDate,
      amount: Number(amount),
    });
    res.status(201).json(deposit);
  } catch (e) {
    if ((e as Error).message === 'Card not found') {
      return res.status(404).json({ error: 'Card not found' });
    }
    res.status(500).json({ error: String(e) });
  }
});

router.get('/:cardId/deposits', async (req, res) => {
  try {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const deposits = await depositService.getDeposits(req.params.cardId, from, to);
    res.json(deposits);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
