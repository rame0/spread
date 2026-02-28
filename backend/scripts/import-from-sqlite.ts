/// <reference path="./sql.js.d.ts" />
/**
 * Import from V1 SQLite into V2 Postgres.
 *
 * V1 schema:
 *   purchases(id, amount, remaining_amount, purchase_date, payment_deadline, paid)
 *   payments(id, purchase_id, payment_date, amount)
 *
 * Mapping: purchases → V2 purchases; payments → V2 deposits.
 *
 * Usage (from backend dir):
 *   pnpm run import:sqlite -- --sqlite /path/to/db.sqlite --user-id <uuid> [--card-id <uuid> | --card-name "Name" --report-day 10]
 *
 * Env: DATABASE_URL (Postgres connection string).
 * Uses sql.js (pure JS, no native bindings).
 */

import * as fs from 'fs';
import * as path from 'path';

type InitSqlJs = (opts?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;

async function loadSqlJs(): Promise<InitSqlJs> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqlJs = require('sql.js');
  return (sqlJs.default ?? sqlJs) as InitSqlJs;
}

interface SqlJsStatic {
  Database: new (data?: Buffer | Uint8Array) => {
    exec(sql: string): { columns: string[]; values: unknown[][] }[];
    close(): void;
  };
}

function toIsoDate(value: unknown): string | null {
  if (value == null) return null;
  const s = typeof value === 'string' ? value : String(value);
  const trimmed = s.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function toAmount(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseArgs(): {
  sqlitePath: string;
  userId: string;
  cardId: string | null;
  cardName: string | null;
  reportDay: number;
} {
  const args = process.argv.slice(2);
  let sqlitePath = '';
  let userId = '';
  let cardId: string | null = null;
  let cardName: string | null = null;
  let reportDay = 10;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--sqlite' && args[i + 1]) sqlitePath = args[++i];
    else if (args[i] === '--user-id' && args[i + 1]) userId = args[++i];
    else if (args[i] === '--card-id' && args[i + 1]) cardId = args[++i];
    else if (args[i] === '--card-name' && args[i + 1]) cardName = args[++i];
    else if (args[i] === '--report-day' && args[i + 1]) reportDay = parseInt(args[++i], 10);
  }

  if (!sqlitePath || !userId) {
    console.error('Usage: pnpm run import:sqlite -- --sqlite <path> --user-id <uuid> [--card-id <uuid> | --card-name "Name" [--report-day 10]]');
    process.exit(1);
  }
  if (!cardId && !cardName) {
    console.error('Provide --card-id or --card-name.');
    process.exit(1);
  }
  if (reportDay < 1 || reportDay > 31) {
    console.error('--report-day must be 1–31');
    process.exit(1);
  }

  return { sqlitePath, userId, cardId, cardName, reportDay };
}

function execRows(db: { exec: (sql: string) => { columns: string[]; values: unknown[][] }[] }, sql: string): unknown[][] {
  const result = db.exec(sql);
  if (!result.length || !result[0].values) return [];
  return result[0].values;
}

async function main(): Promise<void> {
  const { sqlitePath, userId, cardId, cardName, reportDay } = parseArgs();

  const resolved = path.resolve(sqlitePath);
  if (!fs.existsSync(resolved)) {
    console.error('File not found:', resolved);
    process.exit(1);
  }

  const initSqlJs = await loadSqlJs();
  const sqlJsDist = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist');
  const opts = fs.existsSync(path.join(sqlJsDist, 'sql-wasm.wasm'))
    ? { locateFile: (file: string) => path.join(sqlJsDist, file) }
    : undefined;
  const SQL = await initSqlJs(opts);
  const fileBuffer = fs.readFileSync(resolved);
  const db = new SQL.Database(fileBuffer);

  let purchaseValues: unknown[][];
  let paymentValues: unknown[][];
  try {
    purchaseValues = execRows(db, 'SELECT purchase_date, amount FROM purchases ORDER BY purchase_date');
    paymentValues = execRows(db, 'SELECT payment_date, amount FROM payments ORDER BY payment_date');
  } catch (e) {
    db.close();
    console.error('SQLite read failed. Ensure the file has tables "purchases" and "payments".', (e as Error).message);
    process.exit(1);
  }
  db.close();

  const purchases: { purchaseDate: string; amount: number }[] = [];
  for (const row of purchaseValues) {
    const date = toIsoDate(row[0]);
    const amount = toAmount(row[1]);
    if (!date || amount === null) continue;
    purchases.push({ purchaseDate: date, amount });
  }

  const deposits: { depositDate: string; amount: number }[] = [];
  for (const row of paymentValues) {
    const date = toIsoDate(row[0]);
    const amount = toAmount(row[1]);
    if (!date || amount === null) continue;
    deposits.push({ depositDate: date, amount });
  }

  console.log('SQLite: purchases', purchases.length, ', payments', deposits.length);

  if (purchases.length === 0 && deposits.length === 0) {
    console.log('Nothing to import.');
    return;
  }

  const { findUserById } = await import('../src/repositories/userRepository');
  const { findCardById, createCard } = await import('../src/repositories/cardRepository');
  const { addPurchase } = await import('../src/services/purchaseService');
  const { addDeposit } = await import('../src/services/depositService');

  const user = await findUserById(userId);
  if (!user) {
    console.error('User not found:', userId);
    process.exit(1);
  }

  let targetCardId = cardId;
  if (!targetCardId && cardName) {
    const card = await createCard(userId, { name: cardName, reportDay });
    targetCardId = card.id;
    console.log('Created card:', card.name, card.id);
  } else if (targetCardId) {
    const card = await findCardById(targetCardId);
    if (!card || card.userId !== userId) {
      console.error('Card not found or not yours:', targetCardId);
      process.exit(1);
    }
  }

  let donePurchases = 0;
  let doneDeposits = 0;
  for (const p of purchases) {
    try {
      await addPurchase(targetCardId!, p, userId);
      donePurchases++;
    } catch (e) {
      console.warn('Skip purchase', p, (e as Error).message);
    }
  }
  for (const d of deposits) {
    try {
      await addDeposit(targetCardId!, d, userId);
      doneDeposits++;
    } catch (e) {
      console.warn('Skip deposit', d, (e as Error).message);
    }
  }

  console.log('Done. Imported purchases:', donePurchases, ', deposits:', doneDeposits);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
