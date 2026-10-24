import fs from 'node:fs';
import { normalize } from './normalize.ts';

export interface Item {
  text: string;
  /** Purchases with this description, to weight accuracy by how often it occurs. */
  count: number;
  gold: string[];
}

export interface Prediction {
  category: string | null;
  confidence?: number | null;
  ms: number;
}

const gold = JSON.parse(fs.readFileSync(new URL('./data/gold.json', import.meta.url), 'utf8'));
const raw: { description: string; count: number }[] = JSON.parse(
  fs.readFileSync(new URL('./data/descriptions.json', import.meta.url), 'utf8')
);

export const categories: string[] = gold.categories;

export const items: Item[] = [
  ...raw
    .reduce((acc, { description, count }) => {
      const text = normalize(description);
      acc.set(text, (acc.get(text) ?? 0) + count);
      return acc;
    }, new Map<string, number>())
    .entries(),
].map(([text, count]) => ({ text, count, gold: gold.labels[text] }));

export function report(name: string, results: { item: Item; prediction: Prediction }[]) {
  const ok = results.filter(({ item, prediction }) => item.gold.includes(prediction.category ?? ''));
  const total = results.reduce((s, r) => s + r.item.count, 0);
  const weighted = ok.reduce((s, r) => s + r.item.count, 0);
  const ms = results.map((r) => r.prediction.ms).sort((a, b) => a - b);
  const lines = [
    `## ${name}`,
    `unique: ${ok.length}/${results.length} (${((ok.length / results.length) * 100).toFixed(1)}%)`,
    `weighted by purchases: ${weighted}/${total} (${((weighted / total) * 100).toFixed(1)}%)`,
    `latency ms: median ${ms[ms.length >> 1].toFixed(0)}, p95 ${ms[Math.floor(ms.length * 0.95)].toFixed(0)}`,
    `rss MB: ${(process.memoryUsage().rss / 2 ** 20).toFixed(0)}`,
    '',
    'errors:',
    ...results
      .filter((r) => !ok.includes(r))
      .map(
        ({ item, prediction }) =>
          `  ${item.text} → ${prediction.category} (want ${item.gold.join(' | ')})` +
          (prediction.confidence != null ? ` conf=${prediction.confidence.toFixed(2)}` : '')
      ),
  ];
  console.log(lines.join('\n'));
  fs.mkdirSync(new URL('./results/', import.meta.url), { recursive: true });
  fs.writeFileSync(new URL(`./results/${name}.txt`, import.meta.url), lines.join('\n') + '\n');
}
