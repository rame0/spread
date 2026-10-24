import fs from 'node:fs';
import { items } from './dataset.ts';
import { transliterate } from './normalize.ts';

/**
 * Training set for fine-tuning the encoder: bank strings with the teacher's category plus the
 * teacher's hand-typed variants. Hand-typed purchases from the database are the test set, so any
 * synthetic text equal to one of them is dropped and counted instead.
 */
const teacher: Record<string, { bank: boolean; category: string; typed: string[] }> = JSON.parse(
  fs.readFileSync(new URL('./data/teacher.json', import.meta.url), 'utf8')
);
const key = (text: string) => transliterate(text).toLowerCase().replace(/ё/g, 'е').trim();
const test = new Set(items.filter((i) => !teacher[i.text]?.bank).map((i) => key(i.text)));

const rows: { text: string; label: string }[] = [];
const pairs: { bank: string; typed: string }[] = [];
const collisions = new Set<string>();
for (const [text, t] of Object.entries(teacher)) {
  if (!t.bank) continue;
  for (const variant of [text, ...t.typed]) {
    if (test.has(key(variant))) collisions.add(variant);
    else {
      rows.push({ text: transliterate(variant), label: t.category });
      if (variant !== text) pairs.push({ bank: transliterate(text), typed: transliterate(variant) });
    }
  }
}
// Category names are the neighbours of last resort at runtime, so they must stay inside their clusters.
for (const category of new Set(rows.map((r) => r.label))) for (let i = 0; i < 5; i++) rows.push({ text: category, label: category });
fs.writeFileSync(new URL('./data/train.jsonl', import.meta.url), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
fs.writeFileSync(new URL('./data/pairs.jsonl', import.meta.url), pairs.map((p) => JSON.stringify(p)).join('\n') + '\n');
console.log(`${pairs.length} pairs`);
console.log(`${rows.length} training rows, ${test.size} hand-typed test texts`);
console.log(`synthetic texts equal to a real hand-typed one (dropped): ${[...collisions].join(', ') || 'none'}`);
