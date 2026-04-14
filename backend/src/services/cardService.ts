import type { GraceBucketRow } from '../repositories/graceBucketRepository';
import type { GraceBucket } from '../domain/types';
import { resolveCardSettings, type CardSettingsInput } from '../domain/card-grace';
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
  data: CardSettingsInput & { name: string }
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
  data: Partial<{
    reportDay: number;
    graceModel: 'legacy_months' | 'statement_periods';
    gracePeriods: number;
    graceDueDay: number;
    graceStatementPeriods: number;
    paymentDueOffsetDays: number;
  }>,
  userId?: string
) {
  const card = await findCardById(cardId);
  if (!card) return null;
  if (userId != null && card.userId !== userId) return null;

  const merged = resolveCardSettings({
    graceModel: (data.graceModel ?? card.graceModel) as 'legacy_months' | 'statement_periods',
    reportDay: data.reportDay ?? card.reportDay,
    gracePeriods: data.gracePeriods ?? card.gracePeriods,
    graceDueDay: data.graceDueDay ?? card.graceDueDay,
    graceStatementPeriods: data.graceStatementPeriods ?? card.graceStatementPeriods,
    paymentDueOffsetDays: data.paymentDueOffsetDays ?? card.paymentDueOffsetDays,
  });

  return updateCardSettings(cardId, {
    reportDay: merged.reportDay,
    graceModel: merged.graceModel,
    gracePeriods: merged.gracePeriods,
    graceDueDay: merged.graceDueDay,
    graceStatementPeriods: merged.graceStatementPeriods,
    paymentDueOffsetDays: merged.paymentDueOffsetDays,
  });
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
