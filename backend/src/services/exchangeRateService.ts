import { cbrRequestDate, parseCbrDaily } from '../domain/cbr-rates';
import { findLatestRate, findRatesBetween, saveRates } from '../repositories/exchangeRateRepository';
import { logger } from '../logging';

const CBR_DAILY_URL = 'https://www.cbr.ru/scripts/XML_daily.asp';
const FETCH_TIMEOUT_MS = 8000;
/** CBR does not publish rates on weekends and holidays, so a rate stays valid for a few days. */
const RATE_VALID_DAYS = 7;

export interface RatesOnDate {
  /** Roubles per unit; RUB is always 1, currencies without any known rate are absent. */
  rates: Record<string, number>;
  /** Some rate is older than RATE_VALID_DAYS because CBR could not be reached. */
  stale: boolean;
}

function shiftDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function fetchCbrRates(date: string): Promise<Record<string, number>> {
  const response = await fetch(`${CBR_DAILY_URL}?date_req=${cbrRequestDate(date)}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`CBR responded with ${response.status}`);
  const xml = new TextDecoder('windows-1251').decode(await response.arrayBuffer());
  return parseCbrDaily(xml).rates;
}

/** Official rates on `date`, cached in the database; falls back to the newest known rate offline. */
export async function getRates(date: string, currencies: string[]): Promise<RatesOnDate> {
  const rates: Record<string, number> = { RUB: 1 };
  const needed = [...new Set(currencies)].filter((currency) => currency !== 'RUB');
  for (const row of await findRatesBetween(needed, shiftDays(date, -RATE_VALID_DAYS), date)) {
    if (!(row.currency in rates)) rates[row.currency] = row.rubPerUnit;
  }
  let missing = needed.filter((currency) => !(currency in rates));
  if (missing.length === 0) return { rates, stale: false };

  try {
    const fetched = await fetchCbrRates(date);
    await saveRates(date, fetched);
    for (const currency of missing) if (currency in fetched) rates[currency] = fetched[currency];
  } catch (error) {
    logger.warn({ err: error, date }, 'Failed to fetch CBR rates');
  }
  missing = missing.filter((currency) => !(currency in rates));

  let stale = false;
  for (const currency of missing) {
    const latest = await findLatestRate(currency);
    if (latest) {
      rates[currency] = latest.rubPerUnit;
      stale = true;
    }
  }
  return { rates, stale };
}
