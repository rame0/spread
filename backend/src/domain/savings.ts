/**
 * Interest on a savings account or deposit, accrued on the end-of-day balance:
 * - a day's interest is balance × rate / 100 / (365 or 366), actual days of the year;
 * - interest of day d reaches the balance at the start of a later day: the next day for
 *   `daily` capitalization, the monthly payout day for `monthly`, the maturity date for
 *   `maturity`, so a balance the bank shows on a payout day already includes the payout;
 * - a term deposit accrues up to the day before its maturity date and pays out on it;
 * - a balance entered from the bank replaces the calculated one on its date and the
 *   difference is reported; interest accrued but not yet paid out is kept.
 * Nothing is stored: the result is recomputed from the terms, events and snapshots.
 * Pure domain — no DB.
 */

export type InterestMode = 'daily' | 'monthly' | 'maturity';

export interface SavingsTerms {
  mode: InterestMode;
  /** Day of the monthly payout; null or a day missing in the month means its last day. */
  payoutDay: number | null;
  /** YYYY-MM-DD; interest accrues only before it. */
  maturityDate: string | null;
}

export type SavingsEvent = { id?: string; date: string } & (
  | { kind: 'top_up'; amount: number }
  | { kind: 'withdrawal'; amount: number }
  | { kind: 'rate_change'; rate: number }
);

export interface SavingsSnapshot {
  date: string;
  amount: number;
}

export interface SavingsReconciliation {
  date: string;
  /** Calculated balance on the date, before the bank balance replaced it. */
  expected: number;
  actual: number;
  difference: number;
}

export interface SavingsSimulation {
  /** First date with an event or a snapshot; null when there is none. */
  start: string | null;
  /** End-of-day balance on `until`. */
  balance: number;
  /** Interest accrued up to `until` and not yet added to the balance. */
  accrued: number;
  /** Rate in effect on `until`, null before the first rate. */
  rate: number | null;
  /** Interest added to the balance, by calendar month (YYYY-MM), oldest first. */
  incomeByMonth: Array<{ month: string; amount: number }>;
  reconciliations: SavingsReconciliation[];
  /** Days with money on the account but no rate entered yet. */
  daysWithoutRate: number;
  /** End-of-day balance on each requested date; null before `start`. */
  points: Record<string, number | null>;
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const dayMs = 24 * 60 * 60 * 1000;
const toDay = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / dayMs);
const fromDay = (day: number) => new Date(day * dayMs).toISOString().slice(0, 10);

function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

function isPayoutDay(date: string, payoutDay: number | null): boolean {
  const [year, month, day] = date.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day === Math.min(payoutDay ?? lastDay, lastDay);
}

/** The same day of month `months` later, or that month's last day. */
export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

/**
 * Walks day by day from the first event or snapshot to `until`. Events dated after `until`
 * are ignored; pass a future `until` to project the balance with the rate kept as it is.
 */
export function simulateSavings(
  terms: SavingsTerms,
  events: SavingsEvent[],
  snapshots: SavingsSnapshot[],
  until: string,
  pointDates: string[] = []
): SavingsSimulation {
  const eventsByDate = new Map<string, SavingsEvent[]>();
  for (const event of events) eventsByDate.set(event.date, [...(eventsByDate.get(event.date) ?? []), event]);
  const snapshotByDate = new Map(snapshots.map((snapshot) => [snapshot.date, snapshot.amount]));
  const dates = [...eventsByDate.keys(), ...snapshotByDate.keys()].sort();
  const points: Record<string, number | null> = Object.fromEntries(pointDates.map((date) => [date, null]));
  const start = dates[0] ?? null;
  if (start === null || start > until) {
    return { start, balance: 0, accrued: 0, rate: null, incomeByMonth: [], reconciliations: [], daysWithoutRate: 0, points };
  }

  const income = new Map<string, number>();
  const reconciliations: SavingsReconciliation[] = [];
  let balance = 0;
  let accrued = 0;
  let rate: number | null = null;
  let daysWithoutRate = 0;
  /** Nothing to compare the first entered balance with. */
  let started = false;

  const payOut = (date: string) => {
    const amount = round2(accrued);
    accrued = 0;
    if (amount === 0) return;
    balance = round2(balance + amount);
    const month = date.slice(0, 7);
    income.set(month, round2((income.get(month) ?? 0) + amount));
  };

  for (let day = toDay(start), last = toDay(until); day <= last; day++) {
    const date = fromDay(day);
    const matured = terms.maturityDate !== null && date >= terms.maturityDate;

    if (
      terms.mode === 'daily' ||
      (terms.mode === 'monthly' && isPayoutDay(date, terms.payoutDay)) ||
      date === terms.maturityDate
    ) {
      payOut(date);
    }

    for (const event of eventsByDate.get(date) ?? []) {
      if (event.kind === 'top_up') balance = round2(balance + event.amount);
      else if (event.kind === 'withdrawal') balance = round2(balance - event.amount);
      else rate = event.rate;
      if (event.kind !== 'rate_change') started = true;
    }

    const actual = snapshotByDate.get(date);
    if (actual !== undefined) {
      if (started) reconciliations.push({ date, expected: balance, actual, difference: round2(actual - balance) });
      balance = actual;
      started = true;
    }

    if (!matured && balance > 0) {
      if (rate === null) daysWithoutRate++;
      else accrued += (balance * rate) / 100 / daysInYear(Number(date.slice(0, 4)));
    }

    if (date in points) points[date] = balance;
  }

  return {
    start,
    balance,
    accrued: round2(accrued),
    rate,
    incomeByMonth: [...income.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, amount]) => ({ month, amount })),
    reconciliations,
    daysWithoutRate,
    points,
  };
}
