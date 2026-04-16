import type { GraceBucketRow } from '../repositories/graceBucketRepository';
import type { GraceBucket } from '../domain/types';
import {
  createCard,
  findCardsByUserId,
  findCardById,
  updateCardSettings,
} from '../repositories/cardRepository';
import { findBucketsByCardId } from '../repositories/graceBucketRepository';

function rowToBucket(row: GraceBucketRow, asOf: Date): GraceBucket {
  const dueDate = new Date(row.dueDate);
  let status = row.status as GraceBucket['status'];
  if (status === 'active' && row.principalRemaining > 0 && dueDate < asOf) {
    status = 'overdue';
  }
  if (row.principalRemaining <= 0) status = 'closed';
  return {
    id: row.id,
    cardId: row.cardId,
    statementPeriodStart: { year: row.periodYear, month: row.periodMonth },
    principalTotal: row.principalTotal,
    principalRemaining: row.principalRemaining,
    dueDate,
    status,
  };
}

export async function listCards(userId: string) {
  return findCardsByUserId(userId);
}

export async function createCardUseCase(
  userId: string,
  data: { name: string; reportDay: number; gracePeriods?: number; graceDueDay?: number }
) {
  return createCard(userId, data);
}

export async function getCard(cardId: string, userId?: string) {
  const card = await findCardById(cardId);
  if (!card) return null;
  if (userId != null && card.userId !== userId) return null;
  return card;
}

export async function patchCardSettings(
  cardId: string,
  data: Partial<{ reportDay: number; gracePeriods: number; graceDueDay: number }>,
  userId?: string
) {
  const card = await findCardById(cardId);
  if (!card) return null;
  if (userId != null && card.userId !== userId) return null;
  return updateCardSettings(cardId, data);
}

export async function getBucketsForCard(
  cardId: string,
  asOf: Date,
  userId?: string
) {
  const card = await findCardById(cardId);
  if (!card) return null;
  if (userId != null && card.userId !== userId) return null;
  const rows = await findBucketsByCardId(cardId);
  return rows.map((r) => rowToBucket(r, asOf));
}
