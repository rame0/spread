/**
 * Annuity mortgage schedule following Sberbank's general lending terms:
 * - interest accrues daily on the principal balance, actual days / 365 or 366 (p. 3.4);
 * - an interest period runs from the previous payment date (exclusive) to the current one
 *   (inclusive); a missing day of month falls back to the month's last day (p. 3.2.2);
 * - the annuity is S·r / (1 − (1 + r)^−T), r = rate / 1200, T — remaining payments,
 *   rounded to kopecks (p. 3.1.1).
 * The schedule is never stored: it is recomputed from the terms and the recorded events.
 * Pure domain — no DB.
 */

export interface MortgageTerms {
  principal: number;
  /** YYYY-MM-DD */
  issueDate: string;
  /** Percent per year. */
  annualRate: number;
  /** Number of monthly payment dates, the last one being the maturity date. */
  termMonths: number;
  paymentDay: number;
  /** The first payment covers only the interest accrued since issue. */
  firstPaymentInterestOnly: boolean;
}

export type PrepaymentMode = 'reduce_term' | 'reduce_payment';

export type MortgageEvent = { id?: string; date: string } & (
  | { kind: 'payment'; amount: number }
  | { kind: 'prepayment'; amount: number; mode: PrepaymentMode }
  | { kind: 'rate_change'; rate: number }
  | { kind: 'reconciliation'; actualBalance: number }
);

export type MortgageRowStatus = 'paid' | 'overdue' | 'planned';

export interface MortgageRow {
  date: string;
  kind: 'scheduled' | 'prepayment' | 'rate_change' | 'reconciliation';
  /** Money applied on this row (actual if recorded, expected otherwise). */
  payment: number;
  /** Scheduled amount for `scheduled` rows. */
  expected: number;
  interest: number;
  principal: number;
  balanceAfter: number;
  status: MortgageRowStatus;
  /** 1-based number of the scheduled payment. */
  number?: number;
  eventId?: string;
  mode?: PrepaymentMode;
  rate?: number;
  /** Bank balance minus calculated balance, for reconciliations. */
  difference?: number;
}

export interface MortgageSimulation {
  rows: MortgageRow[];
  /** Principal balance as of `asOf`. */
  balance: number;
  /** Monthly annuity payment in effect on `asOf`. */
  currentPayment: number;
  /** Rate in effect on `asOf`. */
  rate: number;
  nextPayment: { date: string; amount: number } | null;
  overdueAmount: number;
  payoffDate: string | null;
  interestPaid: number;
  interestRemaining: number;
}

/** Days an early or late payment is still matched with its scheduled date. */
export const PAYMENT_MATCH_WINDOW_DAYS = 5;
/** Safety cap for loans that run past maturity because of missed payments. */
const MAX_EXTRA_MONTHS = 120;

const DAY_MS = 86_400_000;

function toDay(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

function fromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Payment date `index` months after the issue month (index 1 = first payment). */
export function mortgagePaymentDate(issueDate: string, paymentDay: number, index: number): string {
  const [year, month] = issueDate.split('-').map(Number);
  const month0 = month - 1 + index;
  const targetYear = year + Math.floor(month0 / 12);
  const targetMonth = ((month0 % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return fromDay(Date.UTC(targetYear, targetMonth, Math.min(paymentDay, lastDay)) / DAY_MS);
}

/** Interest for days (from, to] on a constant balance, splitting at year boundaries. */
export function accruedInterest(balance: number, annualRate: number, from: string, to: string): number {
  let start = toDay(from);
  const end = toDay(to);
  let interest = 0;
  while (start < end) {
    const year = new Date((start + 1) * DAY_MS).getUTCFullYear();
    const yearEnd = Date.UTC(year, 11, 31) / DAY_MS;
    const segmentEnd = Math.min(end, yearEnd);
    interest += (balance * annualRate / 100) * (segmentEnd - start) / (isLeap(year) ? 366 : 365);
    start = segmentEnd;
  }
  return interest;
}

/** Annuity payment for balance S, annual rate and T remaining payments (p. 3.1.1). */
export function annuityPayment(balance: number, annualRate: number, payments: number): number {
  if (payments <= 0) return round2(balance);
  const r = annualRate / 1200;
  if (r === 0) return round2(balance / payments);
  return round2((balance * r) / (1 - Math.pow(1 + r, -payments)));
}

/** Payments left to repay the balance with a fixed annuity (used after "reduce term"). */
function paymentsForAnnuity(balance: number, annualRate: number, payment: number): number {
  const r = annualRate / 1200;
  if (r === 0) return Math.ceil(balance / payment);
  const ratio = 1 - (balance * r) / payment;
  if (ratio <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(1, Math.ceil(-Math.log(ratio) / Math.log(1 + r) - 1e-9));
}

export function simulateMortgage(
  terms: MortgageTerms,
  events: MortgageEvent[],
  asOf: string
): MortgageSimulation {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const payments = sorted.filter((event) => event.kind === 'payment') as Array<MortgageEvent & { kind: 'payment' }>;
  const others = sorted.filter((event) => event.kind !== 'payment');
  const asOfDay = toDay(asOf);
  const rows: MortgageRow[] = [];

  let balance = round2(terms.principal);
  let rate = terms.annualRate;
  let accrued = 0;
  let accruedTo = terms.issueDate;
  let remaining = terms.termMonths;
  let annuity = annuityPayment(balance, rate, terms.firstPaymentInterestOnly ? remaining - 1 : remaining);
  let recalcAtNextPayment = false;
  let paymentCursor = 0;
  let otherCursor = 0;
  let asOfState: { annuity: number; rate: number } | null = null;
  /** Remembers the terms in effect on asOf before anything dated later is applied. */
  const passDate = (date: string) => {
    if (!asOfState && toDay(date) > asOfDay) asOfState = { annuity, rate };
  };

  const accrueTo = (date: string) => {
    if (date <= accruedTo) return;
    accrued += accruedInterest(balance, rate, accruedTo, date);
    accruedTo = date;
  };

  const applyEvent = (event: MortgageEvent) => {
    passDate(event.date);
    accrueTo(event.date);
    const past = toDay(event.date) <= asOfDay;
    if (event.kind === 'rate_change') {
      rate = event.rate;
      recalcAtNextPayment = true;
      rows.push({ date: event.date, kind: 'rate_change', payment: 0, expected: 0, interest: 0, principal: 0, balanceAfter: balance, status: past ? 'paid' : 'planned', eventId: event.id, rate });
    } else if (event.kind === 'reconciliation') {
      const actual = round2(event.actualBalance);
      rows.push({ date: event.date, kind: 'reconciliation', payment: 0, expected: 0, interest: 0, principal: 0, balanceAfter: actual, status: past ? 'paid' : 'planned', eventId: event.id, difference: round2(actual - balance) });
      balance = actual;
    } else if (event.kind === 'prepayment') {
      const interest = round2(Math.min(accrued, event.amount));
      accrued = Math.max(0, accrued - interest);
      const principal = round2(Math.min(balance, event.amount - interest));
      balance = round2(balance - principal);
      if (balance > 0) {
        if (event.mode === 'reduce_payment') {
          annuity = annuityPayment(balance, rate, remaining);
        } else {
          remaining = Math.min(remaining, paymentsForAnnuity(balance, rate, annuity));
        }
      }
      rows.push({ date: event.date, kind: 'prepayment', payment: round2(interest + principal), expected: 0, interest, principal, balanceAfter: balance, status: past ? 'paid' : 'planned', eventId: event.id, mode: event.mode });
    }
  };

  const maxIndex = terms.termMonths + MAX_EXTRA_MONTHS;
  for (let index = 1; index <= maxIndex && balance > 0; index += 1) {
    const date = mortgagePaymentDate(terms.issueDate, terms.paymentDay, index);
    if (date <= terms.issueDate) continue;

    while (otherCursor < others.length && others[otherCursor].date < date) applyEvent(others[otherCursor++]);
    passDate(date);
    accrueTo(date);

    const interestDue = round2(accrued);
    const interestOnly = index === 1 && terms.firstPaymentInterestOnly;
    const isLast = remaining <= 1;
    const expected = interestOnly
      ? interestDue
      : isLast || annuity >= balance + interestDue
        ? round2(balance + interestDue)
        : annuity;

    const matchLimit = fromDay(toDay(date) + PAYMENT_MATCH_WINDOW_DAYS);
    let paid = 0;
    let matched = false;
    while (paymentCursor < payments.length && payments[paymentCursor].date <= matchLimit) {
      paid += payments[paymentCursor++].amount;
      matched = true;
    }
    const graceOver = toDay(matchLimit) < asOfDay;
    const status: MortgageRowStatus = matched ? 'paid' : graceOver ? 'overdue' : 'planned';
    const applied = matched ? round2(paid) : status === 'planned' ? expected : 0;

    const interest = round2(Math.min(accrued, applied));
    accrued = Math.max(0, round2(accrued - interest));
    const principal = round2(Math.min(balance, applied - interest));
    balance = round2(balance - principal);
    remaining -= 1;
    if (balance > 0 && (recalcAtNextPayment || interestOnly)) {
      annuity = annuityPayment(balance, rate, Math.max(1, remaining));
      recalcAtNextPayment = false;
    }

    rows.push({ date, kind: 'scheduled', number: index, payment: applied, expected, interest, principal, balanceAfter: balance, status });

    while (otherCursor < others.length && others[otherCursor].date === date) applyEvent(others[otherCursor++]);
  }
  while (otherCursor < others.length) applyEvent(others[otherCursor++]);

  const current: { annuity: number; rate: number } = asOfState ?? { annuity, rate };
  const pastRows = rows.filter((row) => toDay(row.date) <= asOfDay);
  const scheduled = rows.filter((row) => row.kind === 'scheduled');
  const next = scheduled.find((row) => row.status === 'planned');
  return {
    rows,
    balance: pastRows.length > 0 ? pastRows[pastRows.length - 1].balanceAfter : round2(terms.principal),
    currentPayment: current.annuity,
    rate: current.rate,
    nextPayment: next ? { date: next.date, amount: next.expected } : null,
    overdueAmount: round2(scheduled.filter((row) => row.status === 'overdue').reduce((sum, row) => sum + row.expected, 0)),
    payoffDate: scheduled.length > 0 && balance <= 0 ? scheduled[scheduled.length - 1].date : null,
    interestPaid: round2(rows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + row.interest, 0)),
    interestRemaining: round2(rows.filter((row) => row.status === 'planned').reduce((sum, row) => sum + row.interest, 0)),
  };
}

/**
 * Payment events that mark every unpaid scheduled payment up to `until` as paid with the
 * scheduled amount. Re-simulates after each one because a paid row changes later amounts.
 */
export function paymentsToMarkPaid(
  terms: MortgageTerms,
  events: MortgageEvent[],
  until: string
): Array<{ date: string; amount: number }> {
  const added: Array<MortgageEvent & { kind: 'payment' }> = [];
  for (let guard = 0; guard < terms.termMonths + MAX_EXTRA_MONTHS; guard += 1) {
    const simulation = simulateMortgage(terms, [...events, ...added], until);
    const unpaid = simulation.rows.find(
      (row) => row.kind === 'scheduled' && row.status !== 'paid' && row.date <= until
    );
    if (!unpaid) break;
    added.push({ kind: 'payment', date: unpaid.date, amount: unpaid.expected });
  }
  return added.map(({ date, amount }) => ({ date, amount }));
}
