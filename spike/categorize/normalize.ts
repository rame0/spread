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
export function normalize(description: string): string {
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
