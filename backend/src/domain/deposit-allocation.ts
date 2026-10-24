/**
 * Allocate a deposit across active buckets (earliest due first).
 * Pure domain — no DB.
 */

import type { GraceBucket, Allocation } from './types';

/**
 * Allocates `depositAmount` to buckets sorted by dueDate (asc).
 * Returns list of allocations; does not mutate buckets.
 * Excess (deposit > total remaining) is not allocated.
 */
export function allocateDeposit(
  depositId: string,
  depositAmount: number,
  buckets: GraceBucket[]
): Allocation[] {
  const active = buckets
    .filter((b) => (b.status === 'active' || b.status === 'overdue') && b.principalRemaining > 0)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const allocations: Allocation[] = [];
  let remaining = depositAmount;

  for (const bucket of active) {
    if (remaining <= 0) break;
    const amount = Math.min(remaining, bucket.principalRemaining);
    if (amount > 0) {
      allocations.push({
        depositId,
        graceBucketId: bucket.id,
        amount,
      });
      remaining -= amount;
    }
  }

  return allocations;
}

export interface ReplayBucket {
  id: string;
  /** yyyy-MM-dd */
  periodStartDate: string;
  dueDate: string;
  /** Debt of the period before any repayment. */
  debt: number;
}

/** A payment, or a reconciliation that found less debt than calculated. */
export interface Repayment {
  id: string;
  /** yyyy-MM-dd */
  date: string;
  amount: number;
}

const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Allocates all repayments again, in date order, the way the bank does: each one goes to the
 * earliest due debt that already existed on its date. Overpayment waits for later debt.
 * Order-independent, so purchases imported back-dated cannot leave old periods unpaid
 * while later ones are closed. Repayments with the same date keep their given order.
 */
export function replayRepayments(
  buckets: ReplayBucket[],
  repayments: Repayment[]
): { remaining: Map<string, number>; allocations: Array<{ repaymentId: string; graceBucketId: string; amount: number }> } {
  const sorted = [...buckets].sort(
    (a, b) => a.dueDate.localeCompare(b.dueDate) || a.periodStartDate.localeCompare(b.periodStartDate)
  );
  const remaining = new Map(sorted.map((bucket) => [bucket.id, cents(bucket.debt)]));
  const allocations: Array<{ repaymentId: string; graceBucketId: string; amount: number }> = [];
  const credit: Array<{ id: string; left: number }> = [];

  const spend = (until: string | null) => {
    for (const bucket of sorted) {
      if (until !== null && bucket.periodStartDate > until) continue;
      while (credit.length > 0 && (remaining.get(bucket.id) ?? 0) > 0) {
        const head = credit[0];
        const amount = cents(Math.min(head.left, remaining.get(bucket.id) ?? 0));
        remaining.set(bucket.id, cents((remaining.get(bucket.id) ?? 0) - amount));
        head.left = cents(head.left - amount);
        const last = allocations.at(-1);
        if (last && last.repaymentId === head.id && last.graceBucketId === bucket.id) last.amount = cents(last.amount + amount);
        else allocations.push({ repaymentId: head.id, graceBucketId: bucket.id, amount });
        if (head.left <= 0) credit.shift();
      }
      if (credit.length === 0) return;
    }
  };

  const ordered = repayments
    .map((repayment, index) => ({ repayment, index }))
    .sort((a, b) => a.repayment.date.localeCompare(b.repayment.date) || a.index - b.index);
  for (const { repayment } of ordered) {
    if (repayment.amount <= 0) continue;
    credit.push({ id: repayment.id, left: cents(repayment.amount) });
    spend(repayment.date);
  }
  spend(null);
  return { remaining, allocations };
}
