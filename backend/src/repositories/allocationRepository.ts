import { and, asc, eq, inArray, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import { allocations, balanceReconciliations, deposits, reconciliationAllocations } from '../db/schema';

export type AllocationRow = typeof allocations.$inferSelect;

export async function createAllocations(
  depositId: string,
  items: { graceBucketId: string; amount: number }[],
  executor: any = db
): Promise<AllocationRow[]> {
  if (items.length === 0) return [];
  const rows = await executor
    .insert(allocations)
    .values(
      items.map((item) => ({
        depositId,
        graceBucketId: item.graceBucketId,
        amount: item.amount,
      }))
    )
    .returning();
  return rows;
}

export async function findAllocationsByDepositId(
  depositId: string
): Promise<AllocationRow[]> {
  return db.select().from(allocations).where(eq(allocations.depositId, depositId));
}

/** Deposit and negative reconciliation allocations of a card, oldest event first; events without allocations included. */
export async function findCardRepaymentAllocations(cardId: string, executor: any = db) {
  const [depositRows, reconciliationRows] = await Promise.all([
    executor
      .select({ id: deposits.id, date: deposits.depositDate, graceBucketId: allocations.graceBucketId, amount: allocations.amount })
      .from(deposits)
      .leftJoin(allocations, eq(allocations.depositId, deposits.id))
      .where(eq(deposits.cardId, cardId))
      .orderBy(asc(deposits.depositDate), asc(deposits.createdAt)),
    executor
      .select({ id: balanceReconciliations.id, date: balanceReconciliations.reconciliationDate, graceBucketId: reconciliationAllocations.graceBucketId, amount: sql<number>`-${reconciliationAllocations.amount}` })
      .from(balanceReconciliations)
      .innerJoin(reconciliationAllocations, eq(reconciliationAllocations.reconciliationId, balanceReconciliations.id))
      .where(and(eq(balanceReconciliations.cardId, cardId), lt(reconciliationAllocations.amount, 0)))
      .orderBy(asc(balanceReconciliations.reconciliationDate), asc(balanceReconciliations.createdAt)),
  ]);
  type Row = { id: string; date: string; graceBucketId: string | null; amount: number | string | null };
  const toItem = (kind: 'deposit' | 'reconciliation') => (row: Row) => ({ kind, id: row.id, date: row.date, graceBucketId: row.graceBucketId, amount: Number(row.amount ?? 0) });
  return [...depositRows.map(toItem('deposit')), ...reconciliationRows.map(toItem('reconciliation'))];
}

/** Replaces all deposit and negative reconciliation allocations of a card. */
export async function replaceCardRepaymentAllocations(
  cardId: string,
  items: Array<{ kind: 'deposit' | 'reconciliation'; repaymentId: string; graceBucketId: string; amount: number }>,
  executor: any = db
): Promise<void> {
  await executor.delete(allocations).where(
    inArray(allocations.depositId, executor.select({ id: deposits.id }).from(deposits).where(eq(deposits.cardId, cardId)))
  );
  await executor.delete(reconciliationAllocations).where(and(
    lt(reconciliationAllocations.amount, 0),
    inArray(
      reconciliationAllocations.reconciliationId,
      executor.select({ id: balanceReconciliations.id }).from(balanceReconciliations).where(eq(balanceReconciliations.cardId, cardId))
    )
  ));
  const depositItems = items.filter((item) => item.kind === 'deposit');
  const reconciliationItems = items.filter((item) => item.kind === 'reconciliation');
  if (depositItems.length > 0) {
    await executor.insert(allocations).values(depositItems.map((item) => ({ depositId: item.repaymentId, graceBucketId: item.graceBucketId, amount: item.amount })));
  }
  if (reconciliationItems.length > 0) {
    await executor.insert(reconciliationAllocations).values(reconciliationItems.map((item) => ({ reconciliationId: item.repaymentId, graceBucketId: item.graceBucketId, amount: -item.amount })));
  }
}
