/**
 * Expense categorisation: text preparation and the nearest-neighbour choice. Embeddings come from
 * services/categorize; everything here is pure.
 */

const DIGRAPHS: [RegExp, string][] = [
  [/shch/g, 'щ'], [/sch/g, 'щ'], [/zh/g, 'ж'], [/kh/g, 'х'], [/ch/g, 'ч'], [/sh/g, 'ш'], [/ts/g, 'ц'],
  [/yu/g, 'ю'], [/ya/g, 'я'], [/yo/g, 'ё'], [/ye/g, 'е'], [/iy\b/g, 'ий'], [/yj\b/g, 'ый'],
];
const LETTERS: Record<string, string> = {
  a: 'а', b: 'б', c: 'к', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и', j: 'й', k: 'к', l: 'л', m: 'м',
  n: 'н', o: 'о', p: 'п', q: 'к', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'кс', y: 'ы', z: 'з',
};

/** Bank statements spell merchants in Latin while people type them in Cyrillic: MAGNIT vs магнит. */
export function transliterate(text: string): string {
  return text.replace(/[A-Za-z]+/g, (word) =>
    DIGRAPHS.reduce((w, [from, to]) => w.replace(from, to), word.toLowerCase()).replace(/[a-z]/g, (c) => LETTERS[c])
  );
}

const CITIES =
  /\b(MOSCOW|MOSKVA|MOSKOW|SANKT-PETERBU\w*|SANKT-PETERBURG|ST\.? PETERSBURG|SAINT PETERSBURG|ULYANOVSK|ULJANOVSK|ULJYANOVSK|KAZAN|SAMARA|SARATOV|EKATERINBURG|YEKATERINBURG|NOVOSIBIRSK|NIZHNIY NOVGOROD|NIZHNIJ NOVGOROD|ROSTOV-NA-DONU|KRASNODAR|KRASNOYARSK|VORONEZH|PERM|UFA|CHELYABINSK|OMSK|TYUMEN|SOCHI|KALININGRAD|VLADIVOSTOK|TOLYATTI|IZHEVSK|ALMATY|ASTANA|SHYMKENT|KARAGANDA)\b/gi;

/** The city a bank prints next to the merchant says nothing about what was bought. */
export function stripCity(text: string): string {
  return text
    .replace(/( — )[A-Za-z][\w.-]*\s+(?=\S)/, '$1')
    .replace(CITIES, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strips bank boilerplate so only the merchant and the bank's own category stay. */
export function normalizeDescription(description: string): string {
  return description
    .replace(/\.?\s*Операция по карте \*+\d+\.?/i, '')
    .replace(/^Оплата товаров по кредитной карте \d+ сумма [\d.]+ в (.+?) дата .*$/i, '$1')
    .replace(/^Оплата товаров\/услуг на Платформе (\S+?),.*$/i, '$1')
    .replace(/^Оплата (в|услуг) /i, '')
    .replace(/ RUS$/, '')
    .replace(/\b\d{2}\/\d{2}\b/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[.\s]+$/, '')
    .trim();
}

/** Key of an exact rule: the same purchase typed or printed again maps to the same category. */
export function rulePattern(description: string): string {
  return normalizeDescription(description).toLowerCase().slice(0, 512);
}

/** What the encoder sees; the model was trained on text prepared exactly this way. */
export function embeddingText(description: string): string {
  return transliterate(stripCity(normalizeDescription(description)));
}

export function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

export interface Neighbour {
  vector: ArrayLike<number>;
  categoryId: string;
}

export interface NearestCategory {
  categoryId: string;
  /** Similarity of the best category minus the runner-up's; the confidence the threshold is applied to. */
  margin: number;
}

/** Each category scores by its closest neighbour; the best one wins by its lead over the second. */
export function nearestCategory(vector: ArrayLike<number>, neighbours: Neighbour[]): NearestCategory | null {
  const scores = new Map<string, number>();
  for (const neighbour of neighbours) {
    const score = dot(vector, neighbour.vector);
    if (score > (scores.get(neighbour.categoryId) ?? -Infinity)) scores.set(neighbour.categoryId, score);
  }
  const [best, second] = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (!best) return null;
  return { categoryId: best[0], margin: best[1] - (second?.[1] ?? 0) };
}
