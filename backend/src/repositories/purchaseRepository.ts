import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '../db';
import { purchases } from '../db/schema';

export type PurchaseRow = typeof purchases.$inferSelect;

export async function createPurchase(
  cardId: string,
  data: { purchaseDate: string; amount: number; description?: string }
): Promise<PurchaseRow> {
  const [row] = await db
    .insert(purchases)
    .values({
      cardId,
      purchaseDate: data.purchaseDate,
      amount: data.amount,
      description: data.description ?? null,
    })
    .returning();
  if (!row) throw new Error('Failed to create purchase');
  return row;
}

export async function findPurchasesByCardId(
  cardId: string,
  from?: string,
  to?: string
): Promise<PurchaseRow[]> {
  let q = db.select().from(purchases).where(eq(purchases.cardId, cardId));
  const conditions = [eq(purchases.cardId, cardId)];
  if (from) conditions.push(gte(purchases.purchaseDate, from));
  if (to) conditions.push(lte(purchases.purchaseDate, to));
  return db.select().from(purchases).where(and(...conditions));
}
