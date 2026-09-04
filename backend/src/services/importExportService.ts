import { eq } from 'drizzle-orm';
import { resolveCardSettings } from '../domain/card-grace';
import { cards, db } from '../db';
import { findCardById } from '../repositories/cardRepository';
import { findPurchasesByCardId } from '../repositories/purchaseRepository';
import { findDepositsByCardId } from '../repositories/depositRepository';
import { findReconciliationsByCardId } from '../repositories/reconciliationRepository';
import { addPurchase } from './purchaseService';
import { addDeposit } from './depositService';
import { reconcileBalanceInTransaction } from './reconciliationService';

export interface ExportPayload {
  version: 2;
  exportedAt: string;
  card: {
    name: string;
    reportDay: number;
    graceModel: 'legacy_months' | 'statement_periods' | 'ozon_anchor';
    gracePeriods: number;
    graceDueDay: number;
    graceStatementPeriods: number;
    paymentDueOffsetDays: number;
  };
  purchases: Array<{
    purchaseDate: string;
    amount: number;
    description?: string;
  }>;
  deposits: Array<{
    depositDate: string;
    amount: number;
  }>;
  reconciliations: Array<{ reconciliationDate: string; actualDebt: number }>;
  /** A stable chronological stream; preserves ordering for events on the same date. */
  events: Array<
    | { type: 'purchase'; date: string; amount: number; description?: string }
    | { type: 'deposit'; date: string; amount: number }
    | { type: 'reconciliation'; date: string; actualDebt: number }
  >;
}

export interface ImportPayload {
  version?: number;
  card?: {
    name?: string;
    reportDay?: number;
    graceModel?: 'legacy_months' | 'statement_periods' | 'ozon_anchor';
    gracePeriods?: number;
    graceDueDay?: number;
    graceStatementPeriods?: number;
    paymentDueOffsetDays?: number;
  };
  purchases?: Array<{
    purchaseDate?: string;
    amount?: number;
    description?: string;
  }>;
  deposits?: Array<{
    depositDate?: string;
    amount?: number;
  }>;
  reconciliations?: Array<{ reconciliationDate?: string; actualDebt?: number }>;
  events?: Array<{ type?: string; date?: string; amount?: number; actualDebt?: number; description?: string }>;
}

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const MAX_IMPORT_ITEMS = 5000;

function isValidDate(value: string): boolean {
  if (!dateRegex.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf());
}

function normalizeAmount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value <= 0) return null;
  return value;
}

function normalizeDebt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return value;
}

export async function exportCardData(
  cardId: string,
  userId: string
): Promise<ExportPayload | null> {
  const card = await findCardById(cardId);
  if (!card || card.userId !== userId) return null;
  const purchases = await findPurchasesByCardId(cardId);
  const deposits = await findDepositsByCardId(cardId);
  const reconciliations = await findReconciliationsByCardId(cardId);
  const events = [
    ...purchases.map((p) => ({ type: 'purchase' as const, date: p.purchaseDate, amount: p.amount, description: p.description ?? undefined, createdAt: p.createdAt })),
    ...deposits.map((d) => ({ type: 'deposit' as const, date: d.depositDate, amount: d.amount, createdAt: d.createdAt })),
    ...reconciliations.map((r) => ({ type: 'reconciliation' as const, date: r.reconciliationDate, actualDebt: r.actualDebt, createdAt: r.createdAt })),
  ].sort((a, b) => a.date.localeCompare(b.date) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((event) => event.type === 'purchase'
      ? { type: event.type, date: event.date, amount: event.amount, description: event.description }
      : event.type === 'deposit'
        ? { type: event.type, date: event.date, amount: event.amount }
        : { type: event.type, date: event.date, actualDebt: event.actualDebt });
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    card: {
      name: card.name,
      reportDay: card.reportDay,
      graceModel: card.graceModel as 'legacy_months' | 'statement_periods' | 'ozon_anchor',
      gracePeriods: card.gracePeriods,
      graceDueDay: card.graceDueDay,
      graceStatementPeriods: card.graceStatementPeriods,
      paymentDueOffsetDays: card.paymentDueOffsetDays,
    },
    purchases: purchases.map((p) => ({
      purchaseDate: p.purchaseDate,
      amount: p.amount,
      description: p.description ?? undefined,
    })),
    deposits: deposits.map((d) => ({
      depositDate: d.depositDate,
      amount: d.amount,
    })),
    reconciliations: reconciliations.map((r) => ({ reconciliationDate: r.reconciliationDate, actualDebt: r.actualDebt })),
    events,
  };
}

export async function importIntoCard(
  cardId: string,
  payload: ImportPayload,
  userId: string
): Promise<{ importedPurchases: number; importedDeposits: number; importedReconciliations: number } | null> {
  const card = await findCardById(cardId);
  if (!card || card.userId !== userId) return null;
  const purchases = Array.isArray(payload.purchases) ? payload.purchases : [];
  const deposits = Array.isArray(payload.deposits) ? payload.deposits : [];
  const reconciliations = Array.isArray(payload.reconciliations) ? payload.reconciliations : [];

  if (purchases.length > MAX_IMPORT_ITEMS) {
    throw new Error(`Too many purchases in payload (max ${MAX_IMPORT_ITEMS})`);
  }
  if (deposits.length > MAX_IMPORT_ITEMS) {
    throw new Error(`Too many deposits in payload (max ${MAX_IMPORT_ITEMS})`);
  }
  if (reconciliations.length > MAX_IMPORT_ITEMS) throw new Error(`Too many reconciliations in payload (max ${MAX_IMPORT_ITEMS})`);

  const normalizedPurchases = purchases.map((p, index) => {
    if (!p.purchaseDate || !isValidDate(p.purchaseDate)) {
      throw new Error(`Invalid purchaseDate at index ${index}`);
    }
    const amount = normalizeAmount(p.amount);
    if (amount === null) {
      throw new Error(`Invalid purchase amount at index ${index}`);
    }
    return {
      purchaseDate: p.purchaseDate,
      amount,
      description: p.description?.trim() || undefined,
    };
  });

  const normalizedDeposits = deposits.map((d, index) => {
    if (!d.depositDate || !isValidDate(d.depositDate)) {
      throw new Error(`Invalid depositDate at index ${index}`);
    }
    const amount = normalizeAmount(d.amount);
    if (amount === null) {
      throw new Error(`Invalid deposit amount at index ${index}`);
    }
    return { depositDate: d.depositDate, amount };
  });

  const normalizedReconciliations = reconciliations.map((r, index) => {
    if (!r.reconciliationDate || !isValidDate(r.reconciliationDate)) throw new Error(`Invalid reconciliationDate at index ${index}`);
    const actualDebt = normalizeDebt(r.actualDebt);
    if (actualDebt === null) throw new Error(`Invalid reconciliation debt at index ${index}`);
    return { reconciliationDate: r.reconciliationDate, actualDebt };
  });

  const events = payload.version === 2 && Array.isArray(payload.events)
    ? payload.events.map((event, index) => {
      if (!event.date || !isValidDate(event.date)) throw new Error(`Invalid event date at index ${index}`);
      if (event.type === 'purchase') {
        const amount = normalizeAmount(event.amount); if (amount === null) throw new Error(`Invalid purchase event at index ${index}`);
        return { type: 'purchase' as const, date: event.date, amount, description: event.description?.trim() || undefined };
      }
      if (event.type === 'deposit') {
        const amount = normalizeAmount(event.amount); if (amount === null) throw new Error(`Invalid deposit event at index ${index}`);
        return { type: 'deposit' as const, date: event.date, amount };
      }
      if (event.type === 'reconciliation') {
        const actualDebt = normalizeDebt(event.actualDebt); if (actualDebt === null) throw new Error(`Invalid reconciliation event at index ${index}`);
        return { type: 'reconciliation' as const, date: event.date, actualDebt };
      }
      throw new Error(`Invalid event type at index ${index}`);
    })
    : [
      ...normalizedPurchases.map((p) => ({ type: 'purchase' as const, date: p.purchaseDate, ...p })),
      ...normalizedDeposits.map((d) => ({ type: 'deposit' as const, date: d.depositDate, ...d })),
      ...normalizedReconciliations.map((r) => ({ type: 'reconciliation' as const, date: r.reconciliationDate, ...r })),
    ].sort((a, b) => a.date.localeCompare(b.date));

  await db.transaction(async (tx) => {
    if (payload.card) {
      const mergedSettings = resolveCardSettings({
        graceModel:
          payload.card.graceModel ??
          (card.graceModel as 'legacy_months' | 'statement_periods' | 'ozon_anchor'),
        reportDay: payload.card.reportDay ?? card.reportDay,
        gracePeriods: payload.card.gracePeriods ?? card.gracePeriods,
        graceDueDay: payload.card.graceDueDay ?? card.graceDueDay,
        graceStatementPeriods:
          payload.card.graceStatementPeriods ?? card.graceStatementPeriods,
        paymentDueOffsetDays:
          payload.card.paymentDueOffsetDays ?? card.paymentDueOffsetDays,
      });
      await tx
        .update(cards)
        .set({
          reportDay: mergedSettings.reportDay,
          graceModel: mergedSettings.graceModel,
          gracePeriods: mergedSettings.gracePeriods,
          graceDueDay: mergedSettings.graceDueDay,
          graceStatementPeriods: mergedSettings.graceStatementPeriods,
          paymentDueOffsetDays: mergedSettings.paymentDueOffsetDays,
        })
        .where(eq(cards.id, cardId));

      if (payload.card.name && payload.card.name.trim() && payload.card.name.trim() !== card.name) {
        await tx
          .update(cards)
          .set({ name: payload.card.name.trim() })
          .where(eq(cards.id, cardId));
      }
    }
    const [lockedCard] = await tx.select().from(cards).where(eq(cards.id, cardId)).for('update').limit(1);
    for (const event of events) {
      if (event.type === 'purchase') await addPurchase(cardId, { purchaseDate: event.date, amount: event.amount, description: event.description }, userId, tx);
      if (event.type === 'deposit') await addDeposit(cardId, { depositDate: event.date, amount: event.amount }, userId, tx);
      if (event.type === 'reconciliation') await reconcileBalanceInTransaction(cardId, { reconciliationDate: event.date, actualDebt: event.actualDebt }, userId, tx, lockedCard);
    }
  });

  return {
    importedPurchases: events.filter((event) => event.type === 'purchase').length,
    importedDeposits: events.filter((event) => event.type === 'deposit').length,
    importedReconciliations: events.filter((event) => event.type === 'reconciliation').length,
  };
}
