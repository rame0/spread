import { eq } from 'drizzle-orm';
import { resolveCardSettings } from '../domain/card-grace';
import { cards, db } from '../db';
import { findCardById } from '../repositories/cardRepository';
import { findPurchasesByCardId } from '../repositories/purchaseRepository';
import { findDepositsByCardId } from '../repositories/depositRepository';
import { addPurchase } from './purchaseService';
import { addDeposit } from './depositService';

export interface ExportPayload {
  version: 1;
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

export async function exportCardData(
  cardId: string,
  userId: string
): Promise<ExportPayload | null> {
  const card = await findCardById(cardId);
  if (!card || card.userId !== userId) return null;
  const purchases = await findPurchasesByCardId(cardId);
  const deposits = await findDepositsByCardId(cardId);
  return {
    version: 1,
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
  };
}

export async function importIntoCard(
  cardId: string,
  payload: ImportPayload,
  userId: string
): Promise<{ importedPurchases: number; importedDeposits: number } | null> {
  const card = await findCardById(cardId);
  if (!card || card.userId !== userId) return null;
  const purchases = Array.isArray(payload.purchases) ? payload.purchases : [];
  const deposits = Array.isArray(payload.deposits) ? payload.deposits : [];

  if (purchases.length > MAX_IMPORT_ITEMS) {
    throw new Error(`Too many purchases in payload (max ${MAX_IMPORT_ITEMS})`);
  }
  if (deposits.length > MAX_IMPORT_ITEMS) {
    throw new Error(`Too many deposits in payload (max ${MAX_IMPORT_ITEMS})`);
  }

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

  normalizedPurchases.sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));
  normalizedDeposits.sort((a, b) => a.depositDate.localeCompare(b.depositDate));

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
    for (const purchase of normalizedPurchases) {
      await addPurchase(cardId, purchase, userId, tx);
    }
    for (const deposit of normalizedDeposits) {
      await addDeposit(cardId, deposit, userId, tx);
    }
  });

  return {
    importedPurchases: normalizedPurchases.length,
    importedDeposits: normalizedDeposits.length,
  };
}
