/**
 * Parser for the CBR daily rates feed (https://www.cbr.ru/scripts/XML_daily.asp).
 * Its structure is flat and stable, so a full XML parser is not needed.
 */

export interface CbrDailyRates {
  /** Date the rates are effective on, YYYY-MM-DD. */
  date: string;
  /** Roubles per one unit of each currency, keyed by ISO code. */
  rates: Record<string, number>;
}

const parseNumber = (value: string) => Number(value.trim().replace(/\s/g, '').replace(',', '.'));

export function parseCbrDaily(xml: string): CbrDailyRates {
  const dateMatch = /<ValCurs[^>]*\bDate="(\d{2})\.(\d{2})\.(\d{4})"/.exec(xml);
  if (!dateMatch) throw new Error('CBR response has no ValCurs date');
  const [, day, month, year] = dateMatch;
  const rates: Record<string, number> = {};
  for (const [, body] of xml.matchAll(/<Valute\b[^>]*>([\s\S]*?)<\/Valute>/g)) {
    const field = (name: string) => new RegExp(`<${name}>([^<]*)</${name}>`).exec(body)?.[1];
    const code = field('CharCode')?.trim();
    const nominal = parseNumber(field('Nominal') ?? '');
    const value = parseNumber(field('Value') ?? '');
    if (!code || !(nominal > 0) || !(value > 0)) continue;
    rates[code] = Math.round((value / nominal) * 1e6) / 1e6;
  }
  return { date: `${year}-${month}-${day}`, rates };
}

/** Request date in the DD/MM/YYYY form the feed expects. */
export function cbrRequestDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}
