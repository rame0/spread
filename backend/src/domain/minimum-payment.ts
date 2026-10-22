/**
 * Paying a grace card as late as possible: every month only the minimum payment,
 * and each bucket in full on its due date. Pure domain — no DB; dates are yyyy-MM-dd.
 */

import type { CardSettings } from './types';

export interface MinimumPaymentTerms {
  /** Share of the principal, in percent. */
  percent: number;
  /** Lowest minimum payment; the whole debt when it is smaller. */
  minimum: number;
}

/** When statements close and when the minimum payment of each statement is due. */
export interface StatementCalendar {
  /** Latest statement close on or before `date`. */
  closeOnOrBefore(date: string): string;
  nextClose(close: string): string;
  minimumDue(close: string): string;
}

export interface LateScheduleInput {
  today: string;
  terms: MinimumPaymentTerms;
  calendar: StatementCalendar;
  buckets: Array<{ id: string; dueDate: string; remaining: number }>;
  /** Card purchases and payments made after the latest statement, up to today. */
  purchasedSinceStatement: number;
  paidSinceStatement: number;
}

export interface LatePaymentRow {
  date: string;
  amount: number;
  /** Minimum payment due on this date, after what was already paid. */
  minimum: number;
  /** Buckets that must be closed by this date. */
  closing: number;
  bucketIds: string[];
  overdue: boolean;
}

export type PayoffStrategy = 'latest' | 'even';

/** Contract values: Ozon takes 4% but at least 400 ₽, Sber 10% but at least 150 ₽. */
export function defaultMinimumTerms(graceModel: CardSettings['graceModel']): MinimumPaymentTerms {
  return graceModel === 'ozon_anchor' ? { percent: 4, minimum: 400 } : { percent: 10, minimum: 150 };
}

const MAX_STATEMENTS = 60;

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function minimumPayment(debt: number, terms: MinimumPaymentTerms): number {
  if (debt <= 0) return 0;
  if (debt <= terms.minimum) return round2(debt);
  return round2(Math.max(terms.minimum, (debt * terms.percent) / 100));
}

/** Payments by date until the current debt is repaid; payments go to the earliest buckets first. */
export function buildLateSchedule(input: LateScheduleInput): LatePaymentRow[] {
  const { today, terms, calendar } = input;
  const buckets = input.buckets
    .filter((bucket) => bucket.remaining > 0)
    .map((bucket) => ({ ...bucket, due: bucket.dueDate < today ? today : bucket.dueDate, overdue: bucket.dueDate < today }))
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  const debt = () => round2(buckets.reduce((sum, bucket) => sum + bucket.remaining, 0));
  const minimums = new Map<string, number>();
  const rows: LatePaymentRow[] = [];

  // The latest statement's minimum may still be open; what was paid since counts towards it.
  const last = calendar.closeOnOrBefore(today);
  const lastDue = calendar.minimumDue(last);
  if (lastDue >= today) {
    const debtAtStatement = debt() + input.paidSinceStatement - input.purchasedSinceStatement;
    const open = round2(minimumPayment(debtAtStatement, terms) - input.paidSinceStatement);
    if (open > 0) minimums.set(lastDue, open);
  }

  const payUntil = (until: string | null) => {
    const dates = [...new Set([
      ...[...minimums.keys()],
      ...buckets.filter((bucket) => bucket.remaining > 0).map((bucket) => bucket.due),
    ])]
      .filter((date) => until === null || date <= until)
      .sort();
    for (const date of dates) {
      const minimum = minimums.get(date) ?? 0;
      minimums.delete(date);
      const closing = round2(buckets.filter((bucket) => bucket.remaining > 0 && bucket.due <= date).reduce((sum, bucket) => sum + bucket.remaining, 0));
      let left = Math.min(debt(), Math.max(minimum, closing));
      if (left <= 0) continue;
      const row: LatePaymentRow = { date, amount: round2(left), minimum: Math.min(minimum, round2(left)), closing, bucketIds: [], overdue: false };
      for (const bucket of buckets) {
        if (left <= 0) break;
        if (bucket.remaining <= 0) continue;
        const part = Math.min(left, bucket.remaining);
        bucket.remaining = round2(bucket.remaining - part);
        left = round2(left - part);
        row.bucketIds.push(bucket.id);
        if (bucket.overdue && bucket.due === date) row.overdue = true;
      }
      rows.push(row);
    }
  };

  // Payments due on a statement day are made before that statement closes.
  let close = calendar.nextClose(last);
  for (let index = 0; index < MAX_STATEMENTS && (debt() > 0 || minimums.size > 0); index++) {
    payUntil(close);
    const owed = debt();
    if (owed <= 0) break;
    const due = calendar.minimumDue(close);
    minimums.set(due, round2((minimums.get(due) ?? 0) + minimumPayment(owed, terms)));
    close = calendar.nextClose(close);
  }
  payUntil(null);
  return rows;
}

const toDate = (value: string) => new Date(`${value}T00:00:00Z`);
const toKey = (date: Date) => date.toISOString().slice(0, 10);

function addDays(value: string, days: number): string {
  const date = toDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toKey(date);
}

/** The same day `months` months later, or the last day of a shorter month. */
function addMonthsClamped(value: string, months: number, day = Number(value.slice(8, 10))): string {
  const date = toDate(value);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return toKey(target);
}

/**
 * Statement calendar of a card.
 * Ozon: monthly periods from the start of the earliest open bucket, the minimum is due
 * `paymentDueOffsetDays` after a period ends. Other cards close on `reportDay`; legacy cards
 * expect the minimum by `graceDueDay` of the next month, statement-based ones after the offset.
 */
export function statementCalendar(settings: CardSettings, anchorStart?: string): StatementCalendar {
  if (settings.graceModel === 'ozon_anchor') {
    const anchor = anchorStart ?? '2000-01-01';
    const day = Number(anchor.slice(8, 10));
    const periodStart = (k: number) => addMonthsClamped(anchor, k, day);
    const closeOf = (k: number) => addDays(periodStart(k + 1), -1);
    const indexOf = (date: string) => {
      const diff = (Number(date.slice(0, 4)) - Number(anchor.slice(0, 4))) * 12 + Number(date.slice(5, 7)) - Number(anchor.slice(5, 7));
      let k = diff + 1;
      while (closeOf(k) > date) k--;
      while (closeOf(k + 1) <= date) k++;
      return k;
    };
    return {
      closeOnOrBefore: (date) => closeOf(indexOf(date)),
      nextClose: (close) => closeOf(indexOf(close) + 1),
      minimumDue: (close) => addDays(close, settings.paymentDueOffsetDays),
    };
  }

  const reportDay = settings.reportDay;
  const closeIn = (value: string) => addMonthsClamped(`${value.slice(0, 7)}-01`, 0, reportDay);
  return {
    closeOnOrBefore: (date) => {
      const sameMonth = closeIn(date);
      return sameMonth <= date ? sameMonth : addMonthsClamped(`${date.slice(0, 7)}-01`, -1, reportDay);
    },
    nextClose: (close) => addMonthsClamped(`${close.slice(0, 7)}-01`, 1, reportDay),
    minimumDue: (close) =>
      settings.graceModel === 'legacy_months'
        ? addMonthsClamped(`${close.slice(0, 7)}-01`, 1, settings.graceDueDay)
        : addDays(close, settings.paymentDueOffsetDays),
  };
}
