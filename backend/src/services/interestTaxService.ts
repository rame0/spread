import { keyRateRequest, parseKeyRates, type KeyRatePoint } from '../domain/cbr-key-rate';
import { estimateInterestTax, taxFreeLimit } from '../domain/interest-tax';
import { simulateSavings } from '../domain/savings';
import { findAccountsByUserId, findBalancesByAccountIds, findEventsByAccountIds } from '../repositories/accountRepository';
import { findKeyRatesBetween, saveKeyRates } from '../repositories/keyRateRepository';
import { logger } from '../logging';
import { toSavingsEvent, toSavingsTerms } from './savingsService';

const CBR_DAILY_INFO_URL = 'https://www.cbr.ru/DailyInfoWebServ/DailyInfo.asmx';
const FETCH_TIMEOUT_MS = 8000;
/** The key rate is published on working days, so the newest one may be a few days old. */
const KEY_RATE_VALID_DAYS = 7;

function shiftDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function fetchKeyRates(from: string, to: string): Promise<KeyRatePoint[]> {
  const response = await fetch(CBR_DAILY_INFO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '"http://web.cbr.ru/KeyRateXML"' },
    body: keyRateRequest(from, to),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`CBR responded with ${response.status}`);
  return parseKeyRates(await response.text());
}

/** Key rates from a little before `from` up to `to`, cached; `stale` when CBR could not be reached. */
async function getKeyRates(from: string, to: string): Promise<{ rates: KeyRatePoint[]; stale: boolean }> {
  // Start earlier so that `from` itself, often a holiday, has a rate in effect.
  const since = shiftDays(from, -30);
  let rates = await findKeyRatesBetween(since, to);
  const covered = rates.length > 0 && rates[0].date <= from && rates[rates.length - 1].date >= shiftDays(to, -KEY_RATE_VALID_DAYS);
  if (covered) return { rates, stale: false };
  try {
    await saveKeyRates(await fetchKeyRates(since, to));
    rates = await findKeyRatesBetween(since, to);
    return { rates, stale: false };
  } catch (error) {
    logger.warn({ err: error, from, to }, 'Failed to fetch CBR key rates');
    return { rates, stale: true };
  }
}

export interface InterestTaxEstimate {
  year: number;
  /** Interest paid out to RUB savings accounts and deposits so far this year. */
  incomeToDate: number;
  /** Expected interest for the whole year at current rates. */
  incomeForecast: number;
  limit: number;
  maxKeyRate: number | null;
  taxable: number;
  tax: number;
  keyRateStale: boolean;
  /** Currencies of accounts with interest left out of the estimate. */
  excludedCurrencies: string[];
  accounts: number;
}

export async function getInterestTax(userId: string, year: number, today = new Date().toISOString().slice(0, 10)): Promise<InterestTaxEstimate> {
  const accounts = (await findAccountsByUserId(userId)).filter((account) => toSavingsTerms(account) !== null);
  const rubAccounts = accounts.filter((account) => account.currency === 'RUB');
  const ids = rubAccounts.map((account) => account.id);
  const [events, balances] = await Promise.all([findEventsByAccountIds(ids), findBalancesByAccountIds(ids)]);

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const toDate = today < yearEnd ? today : yearEnd;
  const incomeIn = (months: Array<{ month: string; amount: number }>) =>
    months.filter((row) => row.month.startsWith(String(year))).reduce((sum, row) => sum + row.amount, 0);
  let incomeToDate = 0;
  let incomeForecast = 0;
  for (const account of rubAccounts) {
    const terms = toSavingsTerms(account)!;
    const accountEvents = events.filter((row) => row.accountId === account.id).map(toSavingsEvent);
    const snapshots = balances.filter((row) => row.accountId === account.id).map((row) => ({ date: row.balanceDate, amount: row.amount }));
    if (toDate >= yearStart) incomeToDate += incomeIn(simulateSavings(terms, accountEvents, snapshots, toDate).incomeByMonth);
    incomeForecast += incomeIn(simulateSavings(terms, accountEvents, snapshots, yearEnd).incomeByMonth);
  }

  const { rates, stale } = await getKeyRates(yearStart, toDate < yearStart ? yearStart : toDate);
  const { limit, maxKeyRate } = taxFreeLimit(rates, year, today);
  const round2 = (value: number) => Math.round(value * 100) / 100;
  return {
    year,
    incomeToDate: round2(incomeToDate),
    incomeForecast: round2(incomeForecast),
    limit,
    maxKeyRate,
    ...estimateInterestTax(round2(incomeForecast), limit),
    keyRateStale: stale,
    excludedCurrencies: [...new Set(accounts.filter((account) => account.currency !== 'RUB').map((account) => account.currency))].sort(),
    accounts: accounts.length,
  };
}
