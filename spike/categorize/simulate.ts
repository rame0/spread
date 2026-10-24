import fs from 'node:fs';
import { categories } from './dataset.ts';
import { dot, loadEncoder } from './encoder.ts';
import { normalize } from './normalize.ts';

/**
 * Replays purchases in date order the way the app would see them: an exact rule from an earlier
 * confirmation first, then the model, auto-assigning when the margin clears the threshold and asking
 * the user otherwise. Every answer, and every auto-assignment the user later fixes, becomes a rule.
 */
const gold: Record<string, string[]> = JSON.parse(
  fs.readFileSync(new URL('./data/gold.json', import.meta.url), 'utf8')
).labels;
const purchases: { date: string; description: string }[] = JSON.parse(
  fs.readFileSync(new URL('./data/purchases.json', import.meta.url), 'utf8')
);

const embed = await loadEncoder(process.argv[2] ?? 'user2');
const vectors = new Map<string, Float32Array>();
for (const text of [...categories, ...purchases.map((p) => normalize(p.description))])
  if (!vectors.has(text)) vectors.set(text, await embed(text));

// REFERENCE=1 adds the generated merchant set (data/general.json) the app could ship as starting neighbours.
const reference: [string, string][] = [];
if (process.env.REFERENCE === '1') {
  const general: Record<string, { bank: string[]; typed: string[] }[]> = JSON.parse(
    fs.readFileSync(new URL('./data/general.json', import.meta.url), 'utf8')
  );
  for (const [category, merchants] of Object.entries(general))
    for (const m of merchants) for (const text of [...m.bank.map(normalize), ...m.typed]) reference.push([text, category]);
  for (const [text] of reference) if (!vectors.has(text)) vectors.set(text, await embed(text));
}

function predict(text: string, rules: Map<string, string>) {
  const v = vectors.get(text)!;
  const score = new Map(categories.map((c) => [c, dot(v, vectors.get(c)!)]));
  for (const [other, category] of [...reference, ...rules]) score.set(category, Math.max(score.get(category)!, dot(v, vectors.get(other)!)));
  const [best, second] = [...score.entries()].sort((a, b) => b[1] - a[1]);
  return { category: best[0], margin: best[1] - second[1] };
}

console.log(`${purchases.length} purchases, ${new Set(purchases.map((p) => normalize(p.description))).size} distinct descriptions`);
const thresholds = process.env.THRESHOLDS?.split(",").map(Number) ?? [0.1, 0.05, 0.03, 0.02];
for (const threshold of [Infinity, ...thresholds]) {
  const rules = new Map<string, string>();
  const n = { rule: 0, asked: 0, autoOk: 0, autoWrong: 0 };
  const wrong: string[] = [];
  for (const { description } of purchases) {
    const text = normalize(description);
    if (rules.has(text)) {
      n.rule++;
      continue;
    }
    const { category, margin } = predict(text, rules);
    if (margin < threshold) n.asked++;
    else if (gold[text].includes(category)) n.autoOk++;
    else {
      n.autoWrong++;
      wrong.push(`${text} → ${category}`);
    }
    rules.set(text, margin >= threshold && gold[text].includes(category) ? category : gold[text][0]);
  }
  const label = threshold === Infinity ? 'rules only, no model' : `margin ≥ ${threshold}`;
  console.log(
    `${label}: by rule ${n.rule}, asked ${n.asked}, auto correct ${n.autoOk}, auto wrong ${n.autoWrong}` +
      (wrong.length ? `\n    wrong: ${wrong.join('; ')}` : '')
  );
}
