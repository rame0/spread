import { allocateDeposit, replayRepayments } from '../domain/deposit-allocation';
import type { GraceBucket } from '../domain/types';
import { db } from '../db';
import { findCardById } from '../repositories/cardRepository';
import { createDeposit } from '../repositories/depositRepository';
import { findDepositsByCardId } from '../repositories/depositRepository';
import { findBucketsByCardId, updateBucketRemaining } from '../repositories/graceBucketRepository';
import { createAllocations, findCardRepaymentAllocations, replaceCardRepaymentAllocations } from '../repositories/allocationRepository';
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
  // A standalone back-dated deposit must pay the periods that were open on its date.
  const rebalance = executor === undefined;
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
  if (rebalance) await rebalanceCard(cardId);
  return deposit;
}

/**
 * Allocates all payments of a credit card again in date order. Needed after events are
 * added back-dated: incremental allocation has already spent later payments on later periods.
 * Moves debt between periods only; the card's total debt stays the same.
 */
export async function rebalanceCard(cardId: string, executor?: any) {
  const run = async (tx: any) => {
    // Installment payments are due by schedule, not by period; their allocation stays as is.
    const card = await findCardById(cardId, tx);
    if (!card || card.kind === 'installment') return;
    const rows = await findBucketsByCardId(cardId, tx);
    const applied = await findCardRepaymentAllocations(cardId, tx);
    // Debt of a period before repayments: what is left plus what was paid. Changes not
    // recorded as allocations (e.g. of a deleted deposit) stay in their period.
    const paid = new Map<string, number>();
    const repayments = new Map<string, { id: string; date: string; amount: number; kind: 'deposit' | 'reconciliation' }>();
    for (const item of applied) {
      const repayment = repayments.get(item.id) ?? { id: item.id, date: item.date, amount: 0, kind: item.kind };
      repayment.amount += item.amount;
      repayments.set(item.id, repayment);
      if (item.graceBucketId) paid.set(item.graceBucketId, (paid.get(item.graceBucketId) ?? 0) + item.amount);
    }
    const kinds = new Map([...repayments.values()].map((repayment) => [repayment.id, repayment.kind]));
    const { remaining, allocations } = replayRepayments(
      rows.map((row) => ({ ...row, debt: row.principalRemaining + (paid.get(row.id) ?? 0) })),
      [...repayments.values()]
    );
    await replaceCardRepaymentAllocations(
      cardId,
      allocations.map((item) => ({ kind: kinds.get(item.repaymentId)!, ...item })),
      tx
    );
    for (const row of rows) {
      const left = remaining.get(row.id) ?? row.principalRemaining;
      const status = left > 0 ? 'active' : 'closed';
      if (left !== row.principalRemaining || status !== row.status) await updateBucketRemaining(row.id, left, status, tx);
    }
  };
  return executor ? run(executor) : db.transaction(run);
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
