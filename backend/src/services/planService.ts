import { buildPlanForCard } from '../domain/plan';
import { findCardById } from '../repositories/cardRepository';
import { findBucketsByCardId } from '../repositories/graceBucketRepository';
import type { GraceBucketRow } from '../repositories/graceBucketRepository';
import type { GraceBucket } from '../domain/types';

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
    periodStartDate: new Date(row.periodStartDate),
    principalTotal: row.principalTotal,
    principalRemaining: row.principalRemaining,
    dueDate,
    status,
  };
}

export async function getPlan(
  cardId: string,
  asOfStr?: string,
  userId?: string
) {
  const card = await findCardById(cardId);
  if (!card) return null;
  if (userId != null && card.userId !== userId) return null;
  const asOf = asOfStr ? new Date(asOfStr) : new Date();
  const rows = await findBucketsByCardId(cardId);
  const buckets = rows.map((r) => rowToBucket(r, asOf));
  return buildPlanForCard(card.kind, buckets, asOf);
}
