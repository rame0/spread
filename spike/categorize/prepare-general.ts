import fs from 'node:fs';
import { normalize, stripCity, transliterate } from './normalize.ts';

/**
 * Pairs for the encoder from the teacher's generic merchants only (data/general.json), so the model
 * learns banks and typing habits in general rather than one person's shops. Writes:
 *   data/pairs-general.jsonl      bank ↔ typed and bank ↔ bank of the same merchant
 *   data/pairs-general-cat.jsonl  the same plus typed ↔ category name
 */
const general: Record<string, { merchant: string; bank: string[]; typed: string[] }[]> = JSON.parse(
  fs.readFileSync(new URL('./data/general.json', import.meta.url), 'utf8')
);
const prep = (text: string) => transliterate(stripCity(normalize(text)));

const pairs: { anchor: string; positive: string }[] = [];
const withCategories: typeof pairs = [];
for (const [category, merchants] of Object.entries(general))
  for (const { bank, typed } of merchants) {
    const b = bank.map(prep);
    const t = typed.map(prep);
    for (const x of b) for (const y of t) pairs.push({ anchor: y, positive: x });
    for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) pairs.push({ anchor: b[i], positive: b[j] });
    for (const y of t) withCategories.push({ anchor: y, positive: category });
  }
const write = (name: string, rows: typeof pairs) =>
  fs.writeFileSync(new URL(`./data/${name}`, import.meta.url), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
write('pairs-general.jsonl', pairs);
write('pairs-general-cat.jsonl', [...pairs, ...withCategories]);
const count = Object.values(general).reduce((s, m) => s + m.length, 0);
console.log(`${count} merchants in ${Object.keys(general).length} categories: ${pairs.length} pairs, +${withCategories.length} with category names`);
