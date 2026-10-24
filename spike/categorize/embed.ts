import { categories, items, report, type Item, type Prediction } from './dataset.ts';
import { dot, loadEncoder } from './encoder.ts';

const name = process.argv[2] ?? 'user2';
const embed = await loadEncoder(name);

const latency = new Map<string, number>();
const vectors = new Map<string, Float32Array>();
for (const text of [...categories, ...items.map((i) => i.text)]) {
  const start = performance.now();
  vectors.set(text, await embed(text));
  latency.set(text, performance.now() - start);
}

/**
 * Best category by similarity to its name and to already confirmed examples. Confidence is the
 * margin between the best and the runner-up category, which is what decides auto vs. suggest.
 */
function classify(item: Item, confirmed: Item[]): Prediction {
  const v = vectors.get(item.text)!;
  const score = new Map(categories.map((c) => [c, dot(v, vectors.get(c)!)]));
  for (const other of confirmed) {
    const s = dot(v, vectors.get(other.text)!);
    if (s > score.get(other.gold[0])!) score.set(other.gold[0], s);
  }
  const [best, second] = [...score.entries()].sort((a, b) => b[1] - a[1]);
  return { category: best[0], confidence: best[1] - second[1], ms: latency.get(item.text)! };
}

function thresholds(results: { item: Item; prediction: Prediction }[]) {
  for (const t of [0.02, 0.05, 0.1]) {
    const auto = results.filter((r) => r.prediction.confidence! >= t);
    const ok = auto.filter((r) => r.item.gold.includes(r.prediction.category!));
    console.log(`  margin ≥ ${t}: auto ${auto.length}/${results.length}, correct ${ok.length}/${auto.length}`);
  }
}

const zeroShot = items.map((item) => ({ item, prediction: classify(item, []) }));
report(`${name}-zero-shot`, zeroShot);
thresholds(zeroShot);

// Every other description already confirmed by the user: the steady state.
const loo = items.map((item) => ({ item, prediction: classify(item, items.filter((i) => i !== item)) }));
report(`${name}-leave-one-out`, loo);
thresholds(loo);

// Early days: only a handful of confirmations, averaged over random draws.
let seed = 1;
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
for (const n of [10, 25]) {
  let acc = 0;
  for (let run = 0; run < 20; run++) {
    const shuffled = [...items].sort(() => random() - 0.5);
    const confirmed = shuffled.slice(0, n);
    const rest = shuffled.slice(n);
    acc += rest.filter((item) => item.gold.includes(classify(item, confirmed).category!)).length / rest.length;
  }
  console.log(`## ${name} with ${n} random confirmations: ${((acc / 20) * 100).toFixed(1)}% on the rest`);
}
