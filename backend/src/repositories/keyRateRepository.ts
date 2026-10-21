import { and, asc, gte, lte } from 'drizzle-orm';
import { db } from '../db';
import { keyRates } from '../db/schema';
import type { KeyRatePoint } from '../domain/cbr-key-rate';

/** Cached key rates dated within [from, to], oldest first. */
export async function findKeyRatesBetween(from: string, to: string, executor: any = db): Promise<KeyRatePoint[]> {
  const rows = await executor
    .select()
    .from(keyRates)
    .where(and(gte(keyRates.rateDate, from), lte(keyRates.rateDate, to)))
    .orderBy(asc(keyRates.rateDate));
  return rows.map((row: typeof keyRates.$inferSelect) => ({ date: row.rateDate, rate: row.rate }));
}

export async function saveKeyRates(points: KeyRatePoint[], executor: any = db): Promise<void> {
  if (points.length === 0) return;
  await executor
    .insert(keyRates)
    .values(points.map((point) => ({ rateDate: point.date, rate: point.rate })))
    .onConflictDoNothing();
}
