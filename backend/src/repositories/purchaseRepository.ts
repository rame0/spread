import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../db';
import { purchases } from '../db/schema';

export type PurchaseRow = typeof purchases.$inferSelect;

export async function createPurchase(
  cardId: string,
  data: {
    purchaseDate: string;
    amount: number;
    description?: string;
    installmentCount?: number;
    installmentInterval?: string;
    firstPaymentDate?: string;
    installmentFee?: number;
    categoryId?: string | null;
    categorySource?: string | null;
    categoryMargin?: number | null;
  },
  executor: any = db
): Promise<PurchaseRow> {
  const [row] = await executor
    .insert(purchases)
    .values({
      cardId,
      purchaseDate: data.purchaseDate,
      amount: data.amount,
      description: data.description ?? null,
      installmentCount: data.installmentCount ?? null,
      installmentInterval: data.installmentInterval ?? null,
      firstPaymentDate: data.firstPaymentDate ?? null,
      installmentFee: data.installmentFee ?? 0,
      categoryId: data.categoryId ?? null,
      categorySource: data.categorySource ?? null,
      categoryMargin: data.categoryMargin ?? null,
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
  const conditions = [eq(purchases.cardId, cardId)];
  if (from) conditions.push(gte(purchases.purchaseDate, from));
  if (to) conditions.push(lte(purchases.purchaseDate, to));
  return db
    .select()
    .from(purchases)
    .where(and(...conditions))
    .orderBy(desc(purchases.purchaseDate));
}
