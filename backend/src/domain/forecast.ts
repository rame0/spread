/**
 * Cash-flow forecast from the income and expense plan and the known debt payments:
 * - free money is the liquid accounts; savings accounts and deposits grow by their interest
 *   (see savings.ts) and by the plan's transfers to them;
 * - an expense paid with a credit card adds to the card debt on its date and leaves the
 *   accounts on the date the card has to be repaid;
 * - other assets (brokerage accounts, property) stay as they are.
 * Nothing is stored or changed: the forecast is recomputed on every request.
 * Pure domain — no DB.
 */
import { addMonths, simulateSavings, type SavingsEvent, type SavingsSnapshot, type SavingsTerms } from './savings';

export type PlanItemKind = 'income' | 'expense' | 'transfer';
export type PlanFrequency = 'once' | 'weekly' | 'monthly' | 'yearly';

export interface PlanItem {
  id: string;
  kind: PlanItemKind;
  /** In roubles. */
  amount: number;
  frequency: PlanFrequency;
  interval: number;
  startDate: string;
  endDate: string | null;
  spread: boolean;
  cardId: string | null;
  targetAccountId: string | null;
}

export interface Occurrence {
  date: string;
  amount: number;
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const dayMs = 24 * 60 * 60 * 1000;
const toDay = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / dayMs);
const fromDay = (day: number) => new Date(day * dayMs).toISOString().slice(0, 10);

/** Date of the n-th repetition, counted from the start so that the 31st stays the month end. */
function nthDate(item: PlanItem, n: number): string {
  const step = Math.max(1, item.interval);
  if (item.frequency === 'weekly') return fromDay(toDay(item.startDate) + 7 * step * n);
  if (item.frequency === 'monthly') return addMonths(item.startDate, step * n);
  if (item.frequency === 'yearly') return addMonths(item.startDate, 12 * step * n);
  return item.startDate;
}

/**
 * Repetitions of the item within [from, to]. A spread expense is split evenly over the days
 * of each period, from one repetition to the next.
 */
export function occurrences(item: PlanItem, from: string, to: string): Occurrence[] {
  const last = item.endDate !== null && item.endDate < to ? item.endDate : to;
  const result: Occurrence[] = [];
  if (item.frequency === 'once') {
    if (item.startDate >= from && item.startDate <= last) result.push({ date: item.startDate, amount: item.amount });
    return result;
  }
  for (let n = 0; ; n++) {
    const date = nthDate(item, n);
    if (date > last) break;
    if (item.spread && item.kind === 'expense') {
      const next = nthDate(item, n + 1);
      const days = toDay(next) - toDay(date);
      if (next <= from) continue;
      for (let day = Math.max(toDay(date), toDay(from)); day < toDay(next) && day <= toDay(last); day++) {
        result.push({ date: fromDay(day), amount: item.amount / days });
      }
    } else if (date >= from) {
      result.push({ date, amount: item.amount });
    }
  }
  return result;
}

/** Monthly equivalent of an item, for the plan summary. */
export function monthlyAmount(item: Pick<PlanItem, 'amount' | 'frequency' | 'interval'>): number {
  const step = Math.max(1, item.interval);
  if (item.frequency === 'weekly') return round2((item.amount * 365) / 12 / 7 / step);
  if (item.frequency === 'monthly') return round2(item.amount / step);
  if (item.frequency === 'yearly') return round2(item.amount / 12 / step);
  return 0;
}

export interface ForecastSavingsAccount {
  id: string;
  liquid: boolean;
  /** Roubles per unit of the account currency. */
  rate: number;
  terms: SavingsTerms;
  events: SavingsEvent[];
  snapshots: SavingsSnapshot[];
}

export interface ForecastInput {
  today: string;
  until: string;
  /** Liquid accounts without interest, in roubles. */
  liquidCash: number;
  /** Accounts without interest that are not liquid: brokerage, property and so on. */
  fixedAssets: number;
  savings: ForecastSavingsAccount[];
  /** Plain accounts a transfer may go to, with whether they are liquid. */
  plainAccounts: Array<{ id: string; liquid: boolean }>;
  /** Known payments of existing debts; overdue ones should be dated today. */
  debtPayments: Array<{ date: string; amount: number; kind: 'card' | 'mortgage' }>;
  cardDebt: number;
  mortgageDebt: number;
  /** Mortgage principal after each future scheduled payment. */
  mortgageBalances: Array<{ date: string; balance: number }>;
  items: PlanItem[];
  /** Date a purchase made on the card that day must be repaid by; null to pay at once. */
  cardDueDate: (cardId: string, date: string) => string | null;
}

export interface ForecastMonth {
  month: string;
  income: number;
  /** Expenses that leave the accounts on their date. */
  expenses: number;
  /** Planned expenses paid with cards, on their purchase date. */
  cardSpending: number;
  /** Existing debts plus repayment of the planned card spending. */
  debtPayments: number;
  /** Transfers to accounts that are not free money. */
  transfers: number;
  /** Interest on liquid savings accounts. */
  interest: number;
  liquidEnd: number;
  netWorthEnd: number;
}

export interface ForecastResult {
  start: { liquid: number; netWorth: number };
  daily: Array<{ date: string; liquid: number; netWorth: number }>;
  months: ForecastMonth[];
  minLiquid: { date: string; amount: number };
}

const emptyMonth = (month: string): ForecastMonth => ({
  month,
  income: 0,
  expenses: 0,
  cardSpending: 0,
  debtPayments: 0,
  transfers: 0,
  interest: 0,
  liquidEnd: 0,
  netWorthEnd: 0,
});

export function buildForecast(input: ForecastInput): ForecastResult {
  const { today, until } = input;
  const cashFlow = new Map<string, number>();
  const cardDebtFlow = new Map<string, number>();
  const fixedFlow = new Map<string, number>();
  const months = new Map<string, ForecastMonth>();
  const add = (map: Map<string, number>, date: string, amount: number) => map.set(date, (map.get(date) ?? 0) + amount);
  const month = (date: string) => {
    const key = date.slice(0, 7);
    if (!months.has(key)) months.set(key, emptyMonth(key));
    return months.get(key)!;
  };
  for (let day = toDay(today); day <= toDay(until); day++) month(fromDay(day));

  const savingsById = new Map(input.savings.map((account) => [account.id, account]));
  const plainById = new Map(input.plainAccounts.map((account) => [account.id, account]));
  const transfersIn = new Map<string, Occurrence[]>();

  for (const payment of input.debtPayments) {
    if (payment.date > until) continue;
    add(cashFlow, payment.date, -payment.amount);
    if (payment.kind === 'card') add(cardDebtFlow, payment.date, -payment.amount);
    month(payment.date).debtPayments += payment.amount;
  }

  for (const item of input.items) {
    for (const occurrence of occurrences(item, today, until)) {
      const { date, amount } = occurrence;
      if (item.kind === 'income') {
        add(cashFlow, date, amount);
        month(date).income += amount;
      } else if (item.kind === 'expense') {
        const dueDate = item.cardId ? input.cardDueDate(item.cardId, date) : null;
        if (dueDate === null) {
          add(cashFlow, date, -amount);
          month(date).expenses += amount;
        } else {
          add(cardDebtFlow, date, amount);
          month(date).cardSpending += amount;
          if (dueDate <= until) {
            add(cashFlow, dueDate, -amount);
            add(cardDebtFlow, dueDate, -amount);
            month(dueDate).debtPayments += amount;
          }
        }
      } else {
        add(cashFlow, date, -amount);
        const savings = item.targetAccountId ? savingsById.get(item.targetAccountId) : undefined;
        const plain = item.targetAccountId ? plainById.get(item.targetAccountId) : undefined;
        if (savings) {
          transfersIn.set(savings.id, [...(transfersIn.get(savings.id) ?? []), occurrence]);
          if (!savings.liquid) month(date).transfers += amount;
        } else if (plain?.liquid) {
          // Moving money between free accounts changes nothing.
          add(cashFlow, date, amount);
        } else {
          add(fixedFlow, date, amount);
          month(date).transfers += amount;
        }
      }
    }
  }

  const dates: string[] = [];
  for (let day = toDay(today) - 1; day <= toDay(until); day++) dates.push(fromDay(day));
  const savingsPoints = input.savings.map((account) => {
    const extra: SavingsEvent[] = (transfersIn.get(account.id) ?? []).map((occurrence) => ({
      date: occurrence.date,
      kind: 'top_up',
      amount: round2(occurrence.amount / account.rate),
    }));
    const points = simulateSavings(account.terms, [...account.events, ...extra], account.snapshots, until, dates).points;
    return { account, points, transfers: transfersIn.get(account.id) ?? [] };
  });
  const savingsOn = (date: string, liquid: boolean) =>
    savingsPoints
      .filter(({ account }) => account.liquid === liquid)
      .reduce((sum, { account, points }) => sum + (points[date] ?? 0) * account.rate, 0);

  // Interest on liquid savings: the balance change less the money transferred in.
  for (const { account, points, transfers } of savingsPoints) {
    if (!account.liquid) continue;
    for (let index = 1; index < dates.length; index++) {
      const date = dates[index];
      const transferred = transfers.filter((occurrence) => occurrence.date === date).reduce((sum, occurrence) => sum + occurrence.amount, 0);
      month(date).interest += ((points[date] ?? 0) - (points[dates[index - 1]] ?? 0)) * account.rate - transferred;
    }
  }

  const mortgageOn = (date: string) => {
    let balance = input.mortgageDebt;
    for (const row of input.mortgageBalances) {
      if (row.date > date) break;
      balance = row.balance;
    }
    return balance;
  };

  const yesterday = dates[0];
  const liquidStart = input.liquidCash + savingsOn(yesterday, true);
  const start = {
    liquid: round2(liquidStart),
    netWorth: round2(liquidStart + input.fixedAssets + savingsOn(yesterday, false) - input.cardDebt - input.mortgageDebt),
  };

  let cash = input.liquidCash;
  let cardDebt = input.cardDebt;
  let fixed = input.fixedAssets;
  const daily: ForecastResult['daily'] = [];
  let minLiquid = { date: today, amount: Number.POSITIVE_INFINITY };
  for (const date of dates.slice(1)) {
    cash += cashFlow.get(date) ?? 0;
    cardDebt += cardDebtFlow.get(date) ?? 0;
    fixed += fixedFlow.get(date) ?? 0;
    const liquid = round2(cash + savingsOn(date, true));
    const netWorth = round2(liquid + fixed + savingsOn(date, false) - cardDebt - mortgageOn(date));
    daily.push({ date, liquid, netWorth });
    if (liquid < minLiquid.amount) minLiquid = { date, amount: liquid };
    const row = month(date);
    row.liquidEnd = liquid;
    row.netWorthEnd = netWorth;
  }

  return {
    start,
    daily,
    months: [...months.values()].map((row) => ({
      ...row,
      income: round2(row.income),
      expenses: round2(row.expenses),
      cardSpending: round2(row.cardSpending),
      debtPayments: round2(row.debtPayments),
      transfers: round2(row.transfers),
      interest: round2(row.interest),
    })),
    minLiquid,
  };
}

export interface PlanVsFactPeriod {
  /** Period (from, to]: from the previous month end to this month end or today. */
  from: string;
  to: string;
  liquidFrom: number | null;
  liquidTo: number | null;
  /** Debts repaid from the accounts during the period: card deposits and mortgage payments. */
  debtRepaid: number;
  /** Purchases made on cards during the period. */
  cardPurchases: number;
  /** A liquid balance was entered during the period. */
  balancesEntered: boolean;
}

export interface PlanVsFactRow {
  month: string;
  to: string;
  plan: number;
  fact: number | null;
  difference: number | null;
  estimated: boolean;
}

/**
 * What was left after the month's income and spending, planned and actual. Actual spending
 * includes card purchases, which have not left the accounts yet, and leaves out repayments
 * of earlier debts: fact = Δ free money + debts repaid − card purchases.
 */
export function planVsFact(items: PlanItem[], periods: PlanVsFactPeriod[], liquidTargets: Set<string>): PlanVsFactRow[] {
  return periods.map((period) => {
    const from = fromDay(toDay(period.from) + 1);
    let plan = 0;
    for (const item of items) {
      // Transfers between free accounts do not change free money.
      if (item.kind === 'transfer' && item.targetAccountId && liquidTargets.has(item.targetAccountId)) continue;
      const total = occurrences(item, from, period.to).reduce((sum, occurrence) => sum + occurrence.amount, 0);
      plan += item.kind === 'income' ? total : -total;
    }
    const fact =
      period.liquidFrom === null || period.liquidTo === null
        ? null
        : round2(period.liquidTo - period.liquidFrom + period.debtRepaid - period.cardPurchases);
    return {
      month: period.to.slice(0, 7),
      to: period.to,
      plan: round2(plan),
      fact,
      difference: fact === null ? null : round2(fact - plan),
      estimated: !period.balancesEntered,
    };
  });
}
