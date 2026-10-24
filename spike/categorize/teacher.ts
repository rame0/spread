import fs from 'node:fs';
import { categories } from './dataset.ts';
import { normalize } from './normalize.ts';

/**
 * A large local LLM (LM Studio at localhost:1234) labels every distinct description and invents the
 * ways a person would type a bank merchant by hand. Writes data/teacher.json; reruns skip done texts.
 */
const MODEL = process.env.MODEL ?? 'gemma-4-26b-a4b-it@iq3_s';
const URL_API = 'http://localhost:1234/v1/chat/completions';
const OUT = new URL('./data/teacher.json', import.meta.url);

interface Source {
  text: string;
  bank: boolean;
}

const statements: { bankCategory: string | null; description: string }[] = JSON.parse(
  fs.readFileSync(new URL('./data/statements.json', import.meta.url), 'utf8')
);
const manual: { description: string }[] = JSON.parse(
  fs.readFileSync(new URL('./data/descriptions.json', import.meta.url), 'utf8')
);

const sources = new Map<string, Source>();
for (const s of statements) {
  const text = normalize(s.bankCategory ? `${s.bankCategory} — ${s.description}` : s.description);
  sources.set(text, { text, bank: true });
}
for (const m of manual) {
  const text = normalize(m.description);
  // Purchases imported from statements look like bank strings; the rest were typed by hand.
  if (!sources.has(text)) sources.set(text, { text, bank: /[A-Z]{3}|Операция|Оплата товаров/.test(m.description) });
}

const SYSTEM = `Ты помогаешь категоризировать личные расходы пользователя из России (иногда Казахстана).
Тебе дают одно описание траты: строку из банковской выписки (часто «Категория банка — ГОРОД МЕРЧАНТ») или запись, введённую человеком вручную.
Определи:
- merchant: понятное название места или сервиса по-русски (как его называют люди), либо пустую строку, если это не мерчант;
- category: одну категорию из списка;
- confident: true, только если ты действительно знаешь этого мерчанта или смысл записи однозначен;
- typed: только для банковских строк — 3–5 вариантов, как человек мог бы сам записать эту трату в планер расходов: коротко, обычно строчными, по-русски, иногда сокращение или сленг, иногда то, что купили, а не где, иногда с небольшой опечаткой. Для ручных записей — пустой список.

Примеры typed (выдуманные): «Супермаркеты — Moscow PEREKRESTOK 1234» → ["перекресток", "перек", "продукты", "еда домой"]; «MOSCOW YANDEX*4121*TAXI» → ["такси", "яндекс такси", "такси до работы"].

Категории: ${categories.join('; ')}.`;

const SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'label',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        merchant: { type: 'string' },
        category: { type: 'string', enum: categories },
        confident: { type: 'boolean' },
        typed: { type: 'array', items: { type: 'string' }, maxItems: 5 },
      },
      required: ['merchant', 'category', 'confident', 'typed'],
    },
  },
};

async function label({ text, bank }: Source) {
  const response = await fetch(URL_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      response_format: SCHEMA,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `${bank ? 'Банковская строка' : 'Ручная запись'}: ${text}` },
      ],
    }),
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  const json = await response.json();
  return JSON.parse(json.choices[0].message.content);
}

const done: Record<string, unknown> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const queue = [...sources.values()].filter((s) => !done[s.text]);
console.log(`${sources.size} distinct, ${queue.length} to label with ${MODEL}`);
const start = performance.now();
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      done[s.text] = { bank: s.bank, ...(await label(s)) };
      fs.writeFileSync(OUT, JSON.stringify(done, null, 1));
    }
  })
);
console.log(`done in ${((performance.now() - start) / 1000).toFixed(0)} s`);
