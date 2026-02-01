import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { graceBuckets } from '../db/schema';
import type { GraceBucketStatus } from '../domain/types';

export type GraceBucketRow = typeof graceBuckets.$inferSelect;

export async function findBucketByCardAndPeriod(
  cardId: string,
  periodYear: number,
  periodMonth: number
): Promise<GraceBucketRow | null> {
  const [row] = await db
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
  addAmount: number
): Promise<GraceBucketRow> {
  const existing = await findBucketByCardAndPeriod(cardId, periodYear, periodMonth);
  if (existing) {
    const [row] = await db
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
  const [row] = await db
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

export async function findBucketsByCardId(cardId: string): Promise<GraceBucketRow[]> {
  return db
    .select()
    .from(graceBuckets)
    .where(eq(graceBuckets.cardId, cardId))
    .orderBy(desc(graceBuckets.periodYear), desc(graceBuckets.periodMonth));
}

export async function updateBucketRemaining(
  id: string,
  principalRemaining: number,
  status?: GraceBucketStatus
): Promise<void> {
  const set: Record<string, unknown> = {
    principalRemaining,
    updatedAt: new Date(),
  };
  if (status !== undefined) set.status = status;
  await db.update(graceBuckets).set(set).where(eq(graceBuckets.id, id));
}
