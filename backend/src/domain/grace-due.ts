/**
 * Grace due date for a bucket (statement period + gracePeriods).
 * Pure domain — no DB.
 */

import type { StatementPeriodStart } from './types';
import { lastDayOfMonth } from './statement-period';

/**
 * Returns the due date for a bucket whose statement period started at `periodStart`.
 * Bucket must be closed by: periodStart + gracePeriods, on day graceDueDay
 * (or last day of that month if graceDueDay exceeds it).
 *
 * Example: periodStart = January, gracePeriods = 4, graceDueDay = 10
 * → dueDate = 10 May.
 */
export function getGraceDueDate(
  periodStart: StatementPeriodStart,
  gracePeriods: number,
  graceDueDay: number
): Date {
  let year = periodStart.year;
  let month = periodStart.month - 1; // 0-based for Date

  month += gracePeriods;
  while (month > 11) {
    month -= 12;
    year += 1;
  }
  const lastDay = lastDayOfMonth(year, month + 1);
  const day = Math.min(graceDueDay, lastDay);
  return new Date(year, month, day);
}
