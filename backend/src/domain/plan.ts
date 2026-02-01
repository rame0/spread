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
 * Builds a plan: for each calendar month from asOf until the latest due date,
 * suggests how much to deposit so that we never leave the grace period.
 * Each bucket's principalRemaining is spread evenly over every month from asOf to that bucket's due (inclusive).
 */
export function buildPlan(
  buckets: GraceBucket[],
  asOf: Date
): PeriodPlanRow[] {
  const active = buckets.filter(
    (b) => b.status === 'active' && b.principalRemaining > 0
  );
  if (active.length === 0) return [];

  const byPeriod = new Map<string, { amount: number; bucketIds: string[] }>();
  const startYear = asOf.getFullYear();
  const startMonth0 = asOf.getMonth();

  for (const bucket of active) {
    const due = bucket.dueDate;
    const monthsDiff = monthsBetween(asOf, due);
    const periodsLeft = due >= asOf ? Math.max(1, monthsDiff + 1) : 1;
    const amountPerPeriod = bucket.principalRemaining / periodsLeft;

    for (let i = 0; i < periodsLeft; i++) {
      const totalMonths = startMonth0 + i;
      const y = startYear + Math.floor(totalMonths / 12);
      const m = (totalMonths % 12) + 1;
      const key = `${y}-${m}`;
      const existing = byPeriod.get(key);
      if (existing) {
        existing.amount += amountPerPeriod;
        existing.bucketIds.push(bucket.id);
      } else {
        byPeriod.set(key, { amount: amountPerPeriod, bucketIds: [bucket.id] });
      }
    }
  }

  return Array.from(byPeriod.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => {
      const [y, m] = key.split('-').map(Number);
      const lastDayOfMonth = new Date(y, m, 0);
      return {
        year: y,
        month: m,
        dueDate: lastDayOfMonth,
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
