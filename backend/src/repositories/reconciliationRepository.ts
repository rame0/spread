import { desc, eq, max } from 'drizzle-orm';
import { db } from '../db';
import { balanceReconciliations, reconciliationAllocations } from '../db/schema';

export type BalanceReconciliationRow = typeof balanceReconciliations.$inferSelect;

export async function createReconciliation(
  cardId: string,
  values: { reconciliationDate: string; actualDebt: number; calculatedDebtBefore: number; difference: number },
  executor: any = db
): Promise<BalanceReconciliationRow> {
  const [row] = await executor.insert(balanceReconciliations).values({ cardId, ...values }).returning();
  if (!row) throw new Error('Failed to create reconciliation');
  return row;
}

export async function createReconciliationAllocations(
  reconciliationId: string,
  items: { graceBucketId: string; amount: number }[],
  executor: any = db
): Promise<void> {
  if (items.length) await executor.insert(reconciliationAllocations).values(items.map((item) => ({ reconciliationId, ...item })));
}

export async function findReconciliationsByCardId(cardId: string, executor: any = db): Promise<BalanceReconciliationRow[]> {
  return executor.select().from(balanceReconciliations)
    .where(eq(balanceReconciliations.cardId, cardId))
    .orderBy(desc(balanceReconciliations.reconciliationDate), desc(balanceReconciliations.createdAt));
}

export async function findLatestReconciliationDate(cardId: string, executor: any = db): Promise<string | null> {
  const [row] = await executor.select({ date: max(balanceReconciliations.reconciliationDate) })
    .from(balanceReconciliations).where(eq(balanceReconciliations.cardId, cardId));
  return row?.date ?? null;
}
