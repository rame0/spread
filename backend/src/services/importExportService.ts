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
    gracePeriods: number;
    graceDueDay: number;
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
    gracePeriods?: number;
    graceDueDay?: number;
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
      gracePeriods: card.gracePeriods,
      graceDueDay: card.graceDueDay,
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

  for (const purchase of normalizedPurchases) {
    await addPurchase(cardId, purchase, userId);
  }
  for (const deposit of normalizedDeposits) {
    await addDeposit(cardId, deposit, userId);
  }

  return {
    importedPurchases: normalizedPurchases.length,
    importedDeposits: normalizedDeposits.length,
  };
}
