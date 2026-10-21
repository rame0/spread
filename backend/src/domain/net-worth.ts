/**
 * Net worth from account balance snapshots: an account keeps its last known balance
 * until the next snapshot, and is valued in roubles at the rate of the valuation date.
 */

export interface NetWorthAccount {
  id: string;
  name: string;
  kind: string;
  currency: string;
  isLiquid: boolean;
  archivedAt: string | null;
}

export interface BalanceSnapshot {
  date: string;
  amount: number;
}

/** Roubles per unit of the currency, or null when the rate is unknown. */
export type RateLookup = (currency: string) => number | null;

export interface AssetLine {
  accountId: string;
  name: string;
  kind: string;
  currency: string;
  isLiquid: boolean;
  /** Last known balance in the account currency; null when no balance was entered yet. */
  amount: number | null;
  rubAmount: number | null;
  balanceDate: string | null;
  /** The balance was entered more than `staleAfterDays` before the valuation date. */
  stale: boolean;
}

export interface AssetValuation {
  lines: AssetLine[];
  total: number;
  liquidTotal: number;
  /** Part of `total` held in property accounts (a home, a car). */
  propertyTotal: number;
  /** Currencies without a known rate; their accounts are left out of the totals. */
  missingRates: string[];
  /** At least one account has a balance on or before the valuation date. */
  hasBalances: boolean;
}

export const STALE_BALANCE_DAYS = 30;

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const dayMs = 24 * 60 * 60 * 1000;
const toDay = (date: string) => Date.parse(`${date}T00:00:00Z`) / dayMs;

/** Last snapshot dated on or before `date`; `snapshots` are sorted by date ascending. */
export function balanceOn(snapshots: BalanceSnapshot[], date: string): BalanceSnapshot | null {
  let found: BalanceSnapshot | null = null;
  for (const snapshot of snapshots) {
    if (snapshot.date > date) break;
    found = snapshot;
  }
  return found;
}

/** An archived account counts only before its archive date. */
export function isCountedOn(account: NetWorthAccount, date: string): boolean {
  return !account.archivedAt || date < account.archivedAt;
}

export function valueAssets(
  accounts: NetWorthAccount[],
  snapshotsByAccount: Map<string, BalanceSnapshot[]>,
  rate: RateLookup,
  date: string,
  staleAfterDays = STALE_BALANCE_DAYS
): AssetValuation {
  const lines: AssetLine[] = [];
  const missingRates = new Set<string>();
  let total = 0;
  let liquidTotal = 0;
  let propertyTotal = 0;
  let hasBalances = false;
  for (const account of accounts) {
    if (!isCountedOn(account, date)) continue;
    const snapshot = balanceOn(snapshotsByAccount.get(account.id) ?? [], date);
    const rubPerUnit = account.currency === 'RUB' ? 1 : rate(account.currency);
    let rubAmount: number | null = null;
    if (snapshot) {
      hasBalances = true;
      if (rubPerUnit === null) {
        missingRates.add(account.currency);
      } else {
        rubAmount = round2(snapshot.amount * rubPerUnit);
        total += rubAmount;
        if (account.isLiquid) liquidTotal += rubAmount;
        if (account.kind === 'property') propertyTotal += rubAmount;
      }
    }
    lines.push({
      accountId: account.id,
      name: account.name,
      kind: account.kind,
      currency: account.currency,
      isLiquid: account.isLiquid,
      amount: snapshot?.amount ?? null,
      rubAmount,
      balanceDate: snapshot?.date ?? null,
      stale: snapshot ? toDay(date) - toDay(snapshot.date) > staleAfterDays : false,
    });
  }
  return { lines, total: round2(total), liquidTotal: round2(liquidTotal), propertyTotal: round2(propertyTotal), missingRates: [...missingRates].sort(), hasBalances };
}

/** Ends of the `months` months before the month of `asOf`, followed by `asOf` itself. */
export function historyDates(asOf: string, months: number): string[] {
  const [year, month] = asOf.split('-').map(Number);
  const dates: string[] = [];
  for (let offset = months; offset >= 1; offset--) {
    // Day 0 of a month is the last day of the previous one.
    dates.push(new Date(Date.UTC(year, month - offset, 0)).toISOString().slice(0, 10));
  }
  dates.push(asOf);
  return dates;
}

export interface DebtMovement {
  date: string;
  /** Positive adds debt (purchase, upward reconciliation), negative reduces it. */
  amount: number;
}

/** Card debt on a date rebuilt from its movements; an overpayment does not make it negative. */
export function cardDebtOn(movements: DebtMovement[], date: string): number {
  const debt = movements.reduce((sum, movement) => (movement.date <= date ? sum + movement.amount : sum), 0);
  return Math.max(0, round2(debt));
}
