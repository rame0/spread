import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '../db';
import { exchangeRates } from '../db/schema';

export type ExchangeRateRow = typeof exchangeRates.$inferSelect;

/** Rates of the currencies dated within [from, to], newest first. */
export async function findRatesBetween(currencies: string[], from: string, to: string, executor: any = db): Promise<ExchangeRateRow[]> {
  if (currencies.length === 0) return [];
  return executor
    .select()
    .from(exchangeRates)
    .where(and(inArray(exchangeRates.currency, currencies), gte(exchangeRates.rateDate, from), lte(exchangeRates.rateDate, to)))
    .orderBy(desc(exchangeRates.rateDate));
}

/** Newest known rate of the currency, whatever its date. */
export async function findLatestRate(currency: string, executor: any = db): Promise<ExchangeRateRow | null> {
  const [row] = await executor
    .select()
    .from(exchangeRates)
    .where(eq(exchangeRates.currency, currency))
    .orderBy(desc(exchangeRates.rateDate))
    .limit(1);
  return row ?? null;
}

export async function saveRates(rateDate: string, rates: Record<string, number>, executor: any = db): Promise<void> {
  const rows = Object.entries(rates).map(([currency, rubPerUnit]) => ({ rateDate, currency, rubPerUnit }));
  if (rows.length === 0) return;
  await executor.insert(exchangeRates).values(rows).onConflictDoNothing();
}
