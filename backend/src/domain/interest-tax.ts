/**
 * Personal income tax on deposit interest (Tax Code art. 214.2): interest received in a
 * calendar year is taxed above 1 000 000 ₽ × the highest CBR key rate on the first day of
 * any month of that year; the taxable part is 13% up to 2.4 mln ₽ and 15% above it.
 * Pure domain — an estimate, not a tax calculation.
 */
import type { KeyRatePoint } from './cbr-key-rate';

export const TAX_FREE_BASE = 1_000_000;
const HIGHER_RATE_FROM = 2_400_000;

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Rate in effect on the date: the last published on or before it; `rates` are oldest first. */
export function keyRateOn(rates: KeyRatePoint[], date: string): number | null {
  let found: number | null = null;
  for (const point of rates) {
    if (point.date > date) break;
    found = point.rate;
  }
  return found;
}

/** First days of the months of `year`; months after `today` take today's rate as the best guess. */
export function taxFreeLimit(rates: KeyRatePoint[], year: number, today: string): { limit: number; maxKeyRate: number | null } {
  let maxKeyRate: number | null = null;
  for (let month = 1; month <= 12; month++) {
    const first = `${year}-${String(month).padStart(2, '0')}-01`;
    const rate = keyRateOn(rates, first < today ? first : today);
    if (rate !== null && (maxKeyRate === null || rate > maxKeyRate)) maxKeyRate = rate;
  }
  return { limit: maxKeyRate === null ? 0 : round2((TAX_FREE_BASE * maxKeyRate) / 100), maxKeyRate };
}

export function estimateInterestTax(income: number, limit: number): { taxable: number; tax: number } {
  const taxable = Math.max(0, round2(income - limit));
  const tax = Math.min(taxable, HIGHER_RATE_FROM) * 0.13 + Math.max(0, taxable - HIGHER_RATE_FROM) * 0.15;
  return { taxable, tax: Math.round(tax) };
}
