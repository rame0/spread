/**
 * Mapping of T-Bank Invest API (REST gateway) responses. Money comes as `units` (int64 as a
 * string) plus `nano` (billionths), both negative for negative values. Pure domain.
 */

export interface TinvestQuotation {
  units?: string;
  nano?: number;
}

export interface TinvestMoney extends TinvestQuotation {
  currency?: string;
}

export interface TinvestAccount {
  id: string;
  type: string;
  name: string;
  status: string;
}

export interface TinvestPortfolioResponse {
  totalAmountShares?: TinvestMoney;
  totalAmountBonds?: TinvestMoney;
  totalAmountEtf?: TinvestMoney;
  totalAmountCurrencies?: TinvestMoney;
  totalAmountFutures?: TinvestMoney;
  totalAmountOptions?: TinvestMoney;
  totalAmountSp?: TinvestMoney;
  totalAmountPortfolio?: TinvestMoney;
  /** Relative yield of the portfolio, percent. */
  expectedYield?: TinvestQuotation;
  dailyYield?: TinvestMoney;
}

export type PortfolioPart = 'shares' | 'bonds' | 'etf' | 'currencies' | 'futures' | 'options' | 'structured';

export interface PortfolioStructure {
  /** Total value in roubles. */
  total: number;
  parts: Array<{ part: PortfolioPart; amount: number }>;
  /** Yield of the current positions against their average price, percent. */
  expectedYieldPercent: number | null;
  dailyYield: number | null;
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function toNumber(value: TinvestQuotation | undefined): number | null {
  if (!value) return null;
  return Number(value.units ?? '0') + (value.nano ?? 0) / 1e9;
}

const PARTS: Array<[PortfolioPart, keyof TinvestPortfolioResponse]> = [
  ['shares', 'totalAmountShares'],
  ['bonds', 'totalAmountBonds'],
  ['etf', 'totalAmountEtf'],
  ['currencies', 'totalAmountCurrencies'],
  ['futures', 'totalAmountFutures'],
  ['options', 'totalAmountOptions'],
  ['structured', 'totalAmountSp'],
];

/** Portfolio requested in roubles; parts with zero value are left out. */
export function toPortfolioStructure(response: TinvestPortfolioResponse): PortfolioStructure {
  const parts = PARTS.map(([part, key]) => ({ part, amount: round2(toNumber(response[key] as TinvestMoney) ?? 0) })).filter(
    (row) => row.amount !== 0
  );
  const yieldPercent = toNumber(response.expectedYield);
  const daily = toNumber(response.dailyYield);
  return {
    total: round2(toNumber(response.totalAmountPortfolio) ?? 0),
    parts,
    expectedYieldPercent: yieldPercent === null ? null : round2(yieldPercent),
    dailyYield: daily === null ? null : round2(daily),
  };
}

/** Closed accounts have no portfolio worth syncing. */
export function isOpenAccount(account: TinvestAccount): boolean {
  return account.status === 'ACCOUNT_STATUS_OPEN';
}
