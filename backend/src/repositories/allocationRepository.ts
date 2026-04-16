import { eq } from 'drizzle-orm';
import { db } from '../db';
import { allocations } from '../db/schema';

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
