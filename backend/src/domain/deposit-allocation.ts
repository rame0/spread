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
