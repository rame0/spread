import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '../db';
import { deposits } from '../db/schema';

export type DepositRow = typeof deposits.$inferSelect;

export async function createDeposit(
  cardId: string,
  data: { depositDate: string; amount: number }
): Promise<DepositRow> {
  const [row] = await db
    .insert(deposits)
    .values({
      cardId,
      depositDate: data.depositDate,
      amount: data.amount,
    })
    .returning();
  if (!row) throw new Error('Failed to create deposit');
  return row;
}

export async function findDepositsByCardId(
  cardId: string,
  from?: string,
  to?: string
): Promise<DepositRow[]> {
  const conditions = [eq(deposits.cardId, cardId)];
  if (from) conditions.push(gte(deposits.depositDate, from));
  if (to) conditions.push(lte(deposits.depositDate, to));
  return db.select().from(deposits).where(and(...conditions));
}
