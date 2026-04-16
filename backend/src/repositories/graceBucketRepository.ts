import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { graceBuckets } from '../db/schema';
import type { GraceBucketStatus } from '../domain/types';

export type GraceBucketRow = typeof graceBuckets.$inferSelect;

export async function findBucketByCardAndPeriod(
  cardId: string,
  periodYear: number,
  periodMonth: number,
  executor: any = db
): Promise<GraceBucketRow | null> {
  const [row] = await executor
    .select()
    .from(graceBuckets)
    .where(
      and(
        eq(graceBuckets.cardId, cardId),
        eq(graceBuckets.periodYear, periodYear),
        eq(graceBuckets.periodMonth, periodMonth)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function upsertBucket(
  cardId: string,
  periodYear: number,
  periodMonth: number,
  dueDate: string,
  addAmount: number,
  executor: any = db
): Promise<GraceBucketRow> {
  const existing = await findBucketByCardAndPeriod(
    cardId,
    periodYear,
    periodMonth,
    executor
  );
  if (existing) {
    const [row] = await executor
      .update(graceBuckets)
      .set({
        principalTotal: existing.principalTotal + addAmount,
        principalRemaining: existing.principalRemaining + addAmount,
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
      principalTotal: addAmount,
      principalRemaining: addAmount,
      dueDate,
      status: 'active',
    })
    .returning();
  if (!row) throw new Error('Failed to create grace bucket');
  return row;
}

export async function findBucketsByCardId(
  cardId: string,
  executor: any = db
): Promise<GraceBucketRow[]> {
  return executor
    .select()
    .from(graceBuckets)
    .where(eq(graceBuckets.cardId, cardId))
    .orderBy(desc(graceBuckets.periodYear), desc(graceBuckets.periodMonth));
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
