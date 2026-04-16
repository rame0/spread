import { allocateDeposit } from '../domain/deposit-allocation';
import type { GraceBucket } from '../domain/types';
import { findCardById } from '../repositories/cardRepository';
import { createDeposit } from '../repositories/depositRepository';
import { findDepositsByCardId } from '../repositories/depositRepository';
import { findBucketsByCardId, updateBucketRemaining } from '../repositories/graceBucketRepository';
import { createAllocations } from '../repositories/allocationRepository';
import type { GraceBucketRow } from '../repositories/graceBucketRepository';

function rowToBucket(row: GraceBucketRow): GraceBucket {
  return {
    id: row.id,
    cardId: row.cardId,
    statementPeriodStart: { year: row.periodYear, month: row.periodMonth },
    periodStartDate: new Date(row.periodStartDate),
    principalTotal: row.principalTotal,
    principalRemaining: row.principalRemaining,
    dueDate: new Date(row.dueDate),
    status: row.status as GraceBucket['status'],
  };
}

export async function addDeposit(
  cardId: string,
  data: { depositDate: string; amount: number },
  userId?: string,
  executor?: any
) {
  const dbOrTx = executor;
  const card = await findCardById(cardId, dbOrTx);
  if (!card) throw new Error('Card not found');
  if (userId != null && card.userId !== userId) throw new Error('Card not found');
  const deposit = await createDeposit(cardId, data, dbOrTx);
  const rows = await findBucketsByCardId(cardId, dbOrTx);
  const buckets = rows.map(rowToBucket);
  const allocations = allocateDeposit(deposit.id, data.amount, buckets);
  if (allocations.length > 0) {
    await createAllocations(deposit.id, allocations, dbOrTx);
    for (const a of allocations) {
      const bucket = buckets.find((b) => b.id === a.graceBucketId);
      if (!bucket) continue;
      const newRemaining = bucket.principalRemaining - a.amount;
      const status = newRemaining <= 0 ? 'closed' : undefined;
      await updateBucketRemaining(
        a.graceBucketId,
        Math.max(0, newRemaining),
        status,
        dbOrTx
      );
    }
  }
  return deposit;
}

export async function getDeposits(
  cardId: string,
  from?: string,
  to?: string,
  userId?: string
) {
  if (userId != null) {
    const card = await findCardById(cardId);
    if (!card || card.userId !== userId) return [];
  }
  return findDepositsByCardId(cardId, from, to);
}
