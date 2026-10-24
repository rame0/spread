import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Pulls card spending out of bank PDF statements for training data: `node extract.ts <dir>` writes
 * data/statements.json. Rows are cut from `pdftotext -layout` by column position, so a wrapped
 * description is glued back from the lines below its row.
 */
export interface Operation {
  bank: string;
  date: string;
  amount: number;
  currency: string;
  bankCategory: string | null;
  description: string;
}

interface Segment {
  x: number;
  text: string;
}

const MONEY = /([+-])?\s?(\d{1,3}(?:[  ]\d{3})*[.,]\d{2})\s*(₽|₸|USD)?/;
const ROW_DATE = /^\s{0,3}(\d{2})\.(\d{2})\.(\d{2}|\d{4})\b/;
/** Money moving between own accounts or loan repayments, not spending. */
const NOT_SPENDING =
  /перевод|пополнени|погашени|инвесткопилк|брокерск|SBOL|KARTA-VKLAD|вывод средств|снятие|возврат|кэшбэк|cashback|проценты/i;

function segments(line: string): Segment[] {
  return [...line.matchAll(/\S+(?: \S+)*/g)].map((m) => ({ x: m.index!, text: m[0] }));
}

function isoDate(line: string) {
  const [, d, m, y] = line.match(ROW_DATE)!;
  return `${y.length === 2 ? `20${y}` : y}-${m}-${d}`;
}

/** Text of the lines below a row that falls inside the description column. */
function continuation(lines: string[], from: number, start: number, end: number) {
  const parts: string[] = [];
  for (let i = from; i < lines.length && !ROW_DATE.test(lines[i]); i++) {
    const segs = segments(lines[i]);
    // Wrapped neighbour columns (times, document ids) sit beside the description; text from the left margin ends the row.
    if (segs.length === 0 || segs.some((s) => s.x < 5 && !/^\d{2}:\d{2}/.test(s.text))) break;
    parts.push(...segs.filter((s) => s.x >= start - 3 && s.x < end).map((s) => s.text));
  }
  return parts;
}

interface Layout {
  bank: string;
  test: RegExp;
  parse(lines: string[]): Operation[];
}

/** Rows start with a date and carry the amount on the same line. */
function rowStarts(lines: string[]) {
  return lines.flatMap((line, i) => (ROW_DATE.test(line) && MONEY.test(line.slice(12)) ? [i] : []));
}

function money(text: string) {
  const [, sign, value, currency] = text.match(MONEY)!;
  return { sign: sign ?? '', amount: Number(value.replace(/[  ]/g, '').replace(',', '.')), currency: currency ?? '₽' };
}

const LAYOUTS: Layout[] = [
  {
    // Sber credit card and debit account: category and amount on the first line, merchant on the second.
    bank: 'sber',
    test: /Выписка по (сч[её]ту кредитной карты|платёжному сч[её]ту)/,
    parse: (lines) =>
      rowStarts(lines).flatMap((i) => {
        const first = segments(lines[i]);
        const amountSeg = first.find((s, k) => k >= 2 && MONEY.test(s.text))!;
        const second = segments(lines[i + 1] ?? '');
        if (second.length < 3) return [];
        const descX = second[2].x;
        const description = [second.slice(2).map((s) => s.text).join(' '), ...continuation(lines, i + 2, descX, 1000)]
          .join(' ')
          .replace(/\.?\s*Операция по (карте|сч[её]ту)\s*\*+\d+\.?/, '');
        const { sign, amount, currency } = money(amountSeg.text);
        const bankCategory = first.slice(2, first.indexOf(amountSeg)).map((s) => s.text).join(' ');
        if (sign === '+') return [];
        return [{ bank: 'sber', date: isoDate(lines[i]), amount, currency, bankCategory, description }];
      }),
  },
  {
    bank: 'kaspi',
    test: /Kaspi Gold/,
    parse: (lines) =>
      rowStarts(lines).flatMap((i) => {
        const segs = segments(lines[i]);
        const [, amountSeg, kind, details] = segs;
        if (!details || kind.text !== 'Покупка') return [];
        const { sign, amount, currency } = money(amountSeg.text);
        if (sign === '+') return [];
        const extra = continuation(lines, i + 1, details.x, 1000).filter((t) => t !== 'Курсовая разница');
        return [{ bank: 'kaspi', date: isoDate(lines[i]), amount, currency, bankCategory: null, description: [details.text, ...extra].join(' ') }];
      }),
  },
  {
    // Tinkoff: two date columns, two amounts, the description, then the card number.
    bank: 'tinkoff',
    test: /Движение средств за период/,
    parse: (lines) =>
      rowStarts(lines).flatMap((i) => {
        const segs = segments(lines[i]);
        if (segs.length < 6) return [];
        const desc = segs[4];
        const card = segs[5];
        const { sign, amount, currency } = money(segs[3].text);
        if (sign !== '-') return [];
        const description = [desc.text, ...continuation(lines, i + 1, desc.x, card.x - 2)].join(' ');
        return [{ bank: 'tinkoff', date: isoDate(lines[i]), amount, currency, bankCategory: null, description }];
      }),
  },
  {
    // Ozon credit card and account statements: a long document id column wraps beside the description.
    bank: 'ozon',
    test: /ozonbank|Озон Банк|Ozon Банк|Владелец:.*\n.*Номер договора: № \d{4}-\d{2}-\d{2}-KK/i,
    parse: (lines) =>
      rowStarts(lines).flatMap((i) => {
        const segs = segments(lines[i]);
        const amountSeg = segs.find((s, k) => k >= 2 && MONEY.test(s.text) && /₽/.test(s.text));
        if (!amountSeg) return [];
        const descSegs = segs.slice(2, segs.indexOf(amountSeg));
        if (descSegs.length === 0) return [];
        const descX = descSegs[0].x;
        const { sign, amount, currency } = money(amountSeg.text);
        if (sign !== '-') return [];
        const description = [...descSegs.map((s) => s.text), ...continuation(lines, i + 1, descX, amountSeg.x - 1)].join(' ');
        return [{ bank: 'ozon', date: isoDate(lines[i]), amount, currency, bankCategory: null, description }];
      }),
  },
];

const dir = process.argv[2];
const all: Operation[] = [];
for (const file of fs.readdirSync(dir).sort()) {
  const text = execFileSync('pdftotext', ['-layout', path.join(dir, file), '-'], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const layout = LAYOUTS.find((l) => l.test.test(text));
  if (!layout) {
    console.log(`${file}: unknown layout, skipped`);
    continue;
  }
  const ops = layout.parse(text.split('\n')).map((op) => ({ ...op, description: op.description.replace(/\s+/g, ' ').trim() }));
  console.log(`${file}: ${layout.bank}, ${ops.length} purchases`);
  all.push(...ops);
}

// Overlapping statements of the same account repeat operations; keep the most detailed copy.
const unique = new Map<string, Operation>();
for (const op of all) {
  const key = `${op.bank}|${op.date}|${op.amount}|${op.currency}`;
  const seen = unique.get(key);
  if (!seen || op.description.length > seen.description.length) unique.set(key, op);
}
const isSpending = (op: Operation) => !NOT_SPENDING.test(`${op.bankCategory ?? ""} ${op.description}`);
const spending = [...unique.values()].filter(isSpending);
if (process.env.SHOW_SKIPPED) for (const op of unique.values()) if (!isSpending(op)) console.log(`skipped ${op.bank}: ${op.bankCategory ?? ""} ${op.description}`);
spending.sort((a, b) => a.date.localeCompare(b.date));
fs.mkdirSync(new URL('./data/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('./data/statements.json', import.meta.url), JSON.stringify(spending, null, 1));
console.log(`${all.length} parsed, ${unique.size} after dedup, ${spending.length} spending → data/statements.json`);
