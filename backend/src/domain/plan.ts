/**
 * Monthly plan by buckets (how much to deposit per period).
 * Pure domain — no DB.
 */

import type { GraceBucket } from './types';

export interface PeriodPlanRow {
  year: number;
  month: number;
  dueDate: Date;
  amount: number;
  bucketIds: string[];
}

/**
 * Builds a plan: for each period until the latest due date among active buckets,
 * suggests a deposit amount by spreading principalRemaining evenly over remaining periods.
 * Aggregates by (year, month) from bucket due dates.
 */
export function buildPlan(
  buckets: GraceBucket[],
  asOf: Date
): PeriodPlanRow[] {
  const active = buckets.filter(
    (b) => b.status === 'active' && b.principalRemaining > 0
  );
  if (active.length === 0) return [];

  const byPeriod = new Map<string, { dueDate: Date; amount: number; bucketIds: string[] }>();

  for (const bucket of active) {
    const due = bucket.dueDate;
    const key = `${due.getFullYear()}-${due.getMonth() + 1}`;
    const existing = byPeriod.get(key);
    const periodsLeft = monthsBetween(asOf, due);
    const amountPerPeriod =
      periodsLeft > 0 ? bucket.principalRemaining / periodsLeft : bucket.principalRemaining;

    if (existing) {
      existing.amount += amountPerPeriod;
      existing.bucketIds.push(bucket.id);
    } else {
      byPeriod.set(key, {
        dueDate: due,
        amount: amountPerPeriod,
        bucketIds: [bucket.id],
      });
    }
  }

  return Array.from(byPeriod.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => {
      const [y, m] = key.split('-').map(Number);
      return {
        year: y,
        month: m,
        dueDate: v.dueDate,
        amount: Math.round(v.amount * 100) / 100,
        bucketIds: v.bucketIds,
      };
    });
}

function monthsBetween(from: Date, to: Date): number {
  const months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth());
  return Math.max(0, months);
}
