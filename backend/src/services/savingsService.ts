import { addMonths, simulateSavings, type SavingsEvent, type SavingsSimulation, type SavingsTerms } from '../domain/savings';
import {
  createAccountEvent,
  deleteAccountEvent,
  findAccountById,
  findBalancesByAccountIds,
  findEventsByAccountIds,
  type AccountEventInput,
  type AccountEventRow,
  type AccountRow,
} from '../repositories/accountRepository';

/** Account kinds that can earn interest. */
export const INTEREST_KINDS = ['savings', 'deposit'];
export const FORECAST_MONTHS = [3, 6, 12];

export class AccountEventError extends Error {}

export function toSavingsTerms(account: AccountRow): SavingsTerms | null {
  if (!INTEREST_KINDS.includes(account.kind)) return null;
  const mode = account.interestMode;
  if (mode !== 'daily' && mode !== 'monthly' && mode !== 'maturity') return null;
  return { mode, payoutDay: account.payoutDay, maturityDate: account.maturityDate };
}

export function toSavingsEvent(row: AccountEventRow): SavingsEvent {
  const base = { id: row.id, date: row.eventDate };
  if (row.kind === 'rate_change') return { ...base, kind: 'rate_change', rate: row.rate ?? 0 };
  return { ...base, kind: row.kind === 'withdrawal' ? 'withdrawal' : 'top_up', amount: row.amount ?? 0 };
}

async function findOwned(accountId: string, userId: string) {
  const account = await findAccountById(accountId);
  return account && account.userId === userId ? account : null;
}

/** The last `count` calendar months up to the month of `asOf`, with zero for months without income. */
function lastMonths(simulation: SavingsSimulation, asOf: string, count: number) {
  const income = new Map(simulation.incomeByMonth.map((row) => [row.month, row.amount]));
  const months: Array<{ month: string; amount: number }> = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const month = addMonths(`${asOf.slice(0, 7)}-01`, -offset).slice(0, 7);
    months.push({ month, amount: income.get(month) ?? 0 });
  }
  return months;
}

export interface SavingsSummary {
  terms: SavingsTerms | null;
  events: AccountEventRow[];
  /** Null when interest is not calculated for the account. */
  savings: null | {
    balance: number;
    accrued: number;
    rate: number | null;
    daysWithoutRate: number;
    reconciliations: SavingsSimulation['reconciliations'];
    incomeByMonth: Array<{ month: string; amount: number }>;
    incomeThisYear: number;
    forecast: Array<{ months: number; date: string; balance: number }>;
  };
}

export async function getSavings(accountId: string, userId: string, asOf = new Date().toISOString().slice(0, 10)): Promise<SavingsSummary | null> {
  const account = await findOwned(accountId, userId);
  if (!account) return null;
  const events = await findEventsByAccountIds([accountId]);
  const terms = toSavingsTerms(account);
  if (!terms) return { terms, events, savings: null };

  const domainEvents = events.map(toSavingsEvent);
  const snapshots = (await findBalancesByAccountIds([accountId])).map((row) => ({ date: row.balanceDate, amount: row.amount }));
  const current = simulateSavings(terms, domainEvents, snapshots, asOf);
  const forecastDates = FORECAST_MONTHS.map((months) => addMonths(asOf, months));
  const projected = simulateSavings(terms, domainEvents, snapshots, forecastDates[forecastDates.length - 1], forecastDates);
  const year = asOf.slice(0, 4);

  return {
    terms,
    events,
    savings: {
      balance: current.balance,
      accrued: current.accrued,
      rate: current.rate,
      daysWithoutRate: current.daysWithoutRate,
      reconciliations: current.reconciliations,
      incomeByMonth: lastMonths(current, asOf, 12),
      incomeThisYear: Math.round(current.incomeByMonth.filter((row) => row.month.startsWith(year)).reduce((sum, row) => sum + row.amount, 0) * 100) / 100,
      forecast: FORECAST_MONTHS.map((months, index) => ({ months, date: forecastDates[index], balance: projected.points[forecastDates[index]] ?? 0 })),
    },
  };
}

export async function addAccountEvent(accountId: string, userId: string, event: AccountEventInput) {
  const account = await findOwned(accountId, userId);
  if (!account) return null;
  if (!INTEREST_KINDS.includes(account.kind)) throw new AccountEventError('Only savings accounts and deposits have operations');
  return createAccountEvent(accountId, event);
}

export async function removeAccountEvent(accountId: string, userId: string, eventId: string): Promise<boolean> {
  if (!(await findOwned(accountId, userId))) return false;
  return deleteAccountEvent(accountId, eventId);
}
