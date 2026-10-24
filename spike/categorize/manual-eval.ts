import fs from 'node:fs';
import { categories, items } from './dataset.ts';
import { dot, loadEncoder } from './encoder.ts';
import { normalize } from './normalize.ts';

/**
 * Hand-typed purchases against an already categorised bank history: each manual text takes the
 * category of its nearest bank string or category name. Nothing hand-typed is among the neighbours.
 */
const teacher: Record<string, { bank: boolean }> = JSON.parse(fs.readFileSync(new URL('./data/teacher.json', import.meta.url), 'utf8'));
const manual = items.filter((i) => !teacher[i.text]?.bank);
const bank = items.filter((i) => teacher[i.text]?.bank);
const embed = await loadEncoder(process.argv[2]);
const v = new Map<string, Float32Array>();
for (const t of [...categories, ...items.map((i) => i.text)]) v.set(t, await embed(t));

const neighbours = [...(process.env.NO_NAMES ? [] : categories.map((c) => ({ text: c, category: c }))), ...bank.map((i) => ({ text: i.text, category: i.gold[0] }))];
let ok = 0;
const wrong: string[] = [];
for (const item of manual) {
  const best = neighbours.reduce((a, b) => (dot(v.get(item.text)!, v.get(b.text)!) > dot(v.get(item.text)!, v.get(a.text)!) ? b : a));
  if (item.gold.includes(best.category)) ok++;
  else wrong.push(`${item.text} → ${best.category} via «${best.text}»`);
}
console.log(`${process.argv[2]}: hand-typed ${ok}/${manual.length} (${((ok / manual.length) * 100).toFixed(1)}%)`);
if (process.env.VERBOSE) for (const w of wrong) console.log('  ' + w);

// Cold start: a new user has no history yet, so every text, bank or typed, meets only the category names.
const names = (list: typeof items) => list.filter((i) => i.gold.includes(categories.reduce((a, b) => (dot(v.get(i.text)!, v.get(b)!) > dot(v.get(i.text)!, v.get(a)!) ? b : a)))).length;
console.log(`  cold start: hand-typed ${names(manual)}/${manual.length}, bank ${names(bank)}/${bank.length}`);

// Cold start with the generated reference set (data/general.json) shipped as neighbours.
const general: Record<string, { bank: string[]; typed: string[] }[]> = JSON.parse(fs.readFileSync(new URL('./data/general.json', import.meta.url), 'utf8'));
const reference = [...categories.map((c) => ({ text: c, category: c }))];
for (const [category, merchants] of Object.entries(general))
  for (const m of merchants) for (const text of [...m.bank.map((b) => normalize(b)), ...m.typed]) reference.push({ text, category });
for (const r of reference) if (!v.has(r.text)) v.set(r.text, await embed(r.text));
const nearest = (list: typeof items) => list.filter((i) => i.gold.includes(reference.reduce((a, b) => (dot(v.get(i.text)!, v.get(b.text)!) > dot(v.get(i.text)!, v.get(a.text)!) ? b : a)).category)).length;
console.log(`  reference set: hand-typed ${nearest(manual)}/${manual.length}, bank ${nearest(bank)}/${bank.length}`);
