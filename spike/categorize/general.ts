import fs from 'node:fs';
import { categories } from './dataset.ts';

/**
 * Training data that belongs to no one: the teacher lists well-known merchants per category, how
 * different banks print them and how people type them by hand. Writes data/general.json; reruns
 * continue where they stopped. No statement or purchase of the user is shown to the model.
 */
const MODEL = process.env.MODEL ?? 'gemma-4-26b-a4b-it@iq3_s';
const OUT = new URL('./data/general.json', import.meta.url);
const ROUNDS = Number(process.env.ROUNDS ?? 2);

const SYSTEM = `Ты генерируешь обучающие данные для классификатора личных расходов жителей России и Казахстана.
Для заданной категории перечисли 12 разных реальных и популярных мерчантов, сетей или сервисов (федеральные сети, региональные, онлайн-сервисы, маркетплейсы, типичные небольшие места вроде «шаурма», «пекарня», «аптека у дома»).
Для каждого:
- bank: 3 строки, как трата выглядит в выписках разных банков. Форматы: Сбербанк «<категория банка> — <ГОРОД> <MERCHANT> <номер точки>», Т-Банк «Оплата в <MERCHANT> <City> RUS», Ozon/Альфа «<MERCHANT>*<MCC>*<ПРОДУКТ>», Kaspi «<Merchant>». Названия латиницей транслитом, как в эквайринге, разные города России и Казахстана, иногда номер магазина или MCC-код.
- typed: 4 варианта, как человек сам быстро запишет эту трату в планер: коротко, обычно строчными, сокращения, сленг, иногда что купил, а не где, иногда с опечаткой.
Бери только мерчантов, у которых почти все траты относятся именно к этой категории. Универсальные супермаркеты, маркетплейсы и АЗС указывай только в их собственных категориях.
Не используй имена и фамилии частных лиц и ИП.`;

const SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'merchants',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        merchants: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              merchant: { type: 'string' },
              bank: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
              typed: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5 },
            },
            required: ['merchant', 'bank', 'typed'],
          },
        },
      },
      required: ['merchants'],
    },
  },
};

type Merchant = { merchant: string; bank: string[]; typed: string[] };
const done: Record<string, Merchant[]> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

async function generate(category: string, known: string[]) {
  const avoid = known.length ? `\nУже есть, не повторяй: ${known.join(', ')}.` : '';
  const response = await fetch('http://localhost:1234/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.7,
      response_format: SCHEMA,
      // Streaming so the response starts at once: a long reasoning pass would outlive fetch's header timeout.
      stream: true,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Категория: ${category}.${avoid}` },
      ],
    }),
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  let content = '';
  let buffer = '';
  for await (const chunk of response.body!.pipeThrough(new TextDecoderStream())) {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop()!;
    for (const line of lines)
      if (line.startsWith('data: ') && line !== 'data: [DONE]') content += JSON.parse(line.slice(6)).choices[0]?.delta?.content ?? '';
  }
  return JSON.parse(content).merchants as Merchant[];
}

const queue = categories.filter((c) => c !== 'Прочее');
const start = performance.now();
// One worker per loaded model slot: queued requests would otherwise outlive fetch's header timeout.
// Rounds of one category run in sequence so the next one can avoid what the previous produced.
await Promise.all(
  Array.from({ length: Number(process.env.SLOTS ?? 2) }, async () => {
    for (let category = queue.shift(); category; category = queue.shift()) {
      while ((done[category]?.length ?? 0) < ROUNDS * 12 * 0.75) {
        const known = (done[category] ?? []).map((m) => m.merchant);
        done[category] = [...(done[category] ?? []), ...(await generate(category, known))];
        fs.writeFileSync(OUT, JSON.stringify(done, null, 1));
        console.log(`${category}: ${done[category].length}`);
      }
    }
  })
);
console.log(`done in ${((performance.now() - start) / 1000).toFixed(0)} s`);
