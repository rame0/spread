import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { accountBalances, accounts } from '../db/schema';

export type AccountRow = typeof accounts.$inferSelect;
export type AccountBalanceRow = typeof accountBalances.$inferSelect;

export interface AccountInput {
  name: string;
  kind: 'cash' | 'debit' | 'savings' | 'deposit' | 'brokerage' | 'other';
  currency: string;
  institution?: string | null;
  isLiquid: boolean;
  archivedAt?: string | null;
}

export async function createAccount(userId: string, data: AccountInput, executor: any = db): Promise<AccountRow> {
  const [row] = await executor.insert(accounts).values({ userId, ...data }).returning();
  if (!row) throw new Error('Failed to create account');
  return row;
}

export async function findAccountsByUserId(userId: string, executor: any = db): Promise<AccountRow[]> {
  return executor.select().from(accounts).where(eq(accounts.userId, userId)).orderBy(asc(accounts.createdAt));
}

export async function findAccountById(id: string, executor: any = db): Promise<AccountRow | null> {
  const [row] = await executor.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  return row ?? null;
}

export async function updateAccount(id: string, data: Partial<AccountInput>, executor: any = db): Promise<AccountRow | null> {
  const [row] = await executor.update(accounts).set(data).where(eq(accounts.id, id)).returning();
  return row ?? null;
}

export async function deleteAccount(id: string, executor: any = db): Promise<void> {
  await executor.delete(accounts).where(eq(accounts.id, id));
}

/** Balances of the given accounts, oldest first. */
export async function findBalancesByAccountIds(accountIds: string[], executor: any = db): Promise<AccountBalanceRow[]> {
  if (accountIds.length === 0) return [];
  return executor
    .select()
    .from(accountBalances)
    .where(inArray(accountBalances.accountId, accountIds))
    .orderBy(asc(accountBalances.balanceDate));
}

/** One snapshot per day: entering a balance again for the same date replaces it. */
export async function upsertBalance(
  accountId: string,
  balanceDate: string,
  data: { amount: number; note?: string | null },
  executor: any = db
): Promise<AccountBalanceRow> {
  const values = { amount: data.amount, note: data.note ?? null };
  const [row] = await executor
    .insert(accountBalances)
    .values({ accountId, balanceDate, ...values })
    .onConflictDoUpdate({ target: [accountBalances.accountId, accountBalances.balanceDate], set: values })
    .returning();
  if (!row) throw new Error('Failed to save balance');
  return row;
}

export async function deleteBalance(accountId: string, balanceDate: string, executor: any = db): Promise<boolean> {
  const rows = await executor
    .delete(accountBalances)
    .where(and(eq(accountBalances.accountId, accountId), eq(accountBalances.balanceDate, balanceDate)))
    .returning({ id: accountBalances.id });
  return rows.length > 0;
}
