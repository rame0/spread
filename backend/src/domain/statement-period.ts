/**
 * Statement period start for a purchase date (reportDay rule).
 * Pure domain — no DB.
 */

import type { StatementPeriodStart } from './types';

/**
 * Returns the statement period start (year, month) for a purchase on `date`
 * given `reportDay` D (1–31).
 *
 * Rule:
 * - if date.day <= D → period started in previous month
 * - if date.day > D  → period started in current month
 *
 * Examples for reportDay=10:
 * - 9 Feb  → January (prev month)
 * - 10 Feb → January
 * - 11 Feb → February (current)
 */
export function getStatementPeriodStart(
  date: Date,
  reportDay: number
): StatementPeriodStart {
  const day = date.getDate();
  let year = date.getFullYear();
  let month = date.getMonth() + 1; // 1–12

  if (day <= reportDay) {
    // period started previous month
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  }
  return { year, month };
}

/**
 * Normalizes day to last day of month if month has fewer days.
 * Used for dueDate (e.g. graceDueDay=31 in February → 28/29).
 */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
