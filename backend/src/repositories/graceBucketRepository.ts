import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../db';
import { graceBuckets } from '../db/schema';
import type { GraceBucketStatus } from '../domain/types';

export type GraceBucketRow = typeof graceBuckets.$inferSelect;

export async function findBucketByCardAndPeriod(
  cardId: string,
  periodStartDate: string,
  executor: any = db
): Promise<GraceBucketRow | null> {
  const [row] = await executor
    .select()
    .from(graceBuckets)
    .where(
      and(
        eq(graceBuckets.cardId, cardId),
        eq(graceBuckets.periodStartDate, periodStartDate),
        isNull(graceBuckets.purchaseId)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function upsertBucket(
  cardId: string,
  periodYear: number,
  periodMonth: number,
  periodStartDate: string,
  dueDate: string,
  addAmount: number,
  executor: any = db
): Promise<GraceBucketRow> {
  const existing = await findBucketByCardAndPeriod(cardId, periodStartDate, executor);
  if (existing) {
    const [row] = await executor
      .update(graceBuckets)
      .set({
        principalTotal: existing.principalTotal + addAmount,
        principalRemaining: existing.principalRemaining + addAmount,
        // A new charge may belong to a period that was paid off earlier.
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(graceBuckets.id, existing.id))
      .returning();
    if (!row) throw new Error('Failed to update grace bucket');
    return row;
  }
  const [row] = await executor
    .insert(graceBuckets)
      .values({
        cardId,
        periodYear,
        periodMonth,
        periodStartDate,
        principalTotal: addAmount,
        principalRemaining: addAmount,
        dueDate,
      status: 'active',
    })
    .returning();
  if (!row) throw new Error('Failed to create grace bucket');
  return row;
}

/** One bucket per scheduled payment of an installment purchase. */
export async function insertInstallmentBuckets(
  cardId: string,
  purchaseId: string,
  payments: Array<{ number: number; dueDate: string; amount: number }>,
  executor: any = db
): Promise<GraceBucketRow[]> {
  return executor
    .insert(graceBuckets)
    .values(
      payments.map((payment) => {
        const [year, month] = payment.dueDate.split('-').map(Number);
        return {
          cardId,
          purchaseId,
          installmentNumber: payment.number,
          periodYear: year,
          periodMonth: month,
          periodStartDate: payment.dueDate,
          principalTotal: payment.amount,
          principalRemaining: payment.amount,
          dueDate: payment.dueDate,
          status: 'active' as const,
        };
      })
    )
    .returning();
}

export async function findBucketsByCardId(
  cardId: string,
  executor: any = db
): Promise<GraceBucketRow[]> {
  return executor
    .select()
    .from(graceBuckets)
    .where(eq(graceBuckets.cardId, cardId))
    .orderBy(desc(graceBuckets.periodStartDate));
}

export async function updateBucketRemaining(
  id: string,
  principalRemaining: number,
  status?: GraceBucketStatus,
  executor: any = db
): Promise<void> {
  const set: Record<string, unknown> = {
    principalRemaining,
    updatedAt: new Date(),
  };
  if (status !== undefined) set.status = status;
  await executor.update(graceBuckets).set(set).where(eq(graceBuckets.id, id));
}
