import { and, count, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
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

/** One page of a card's purchases, newest first; `query` matches the description or the amount. */
export async function findPurchasePage(
  cardId: string,
  page: { limit: number; offset: number; query?: string }
): Promise<{ items: PurchaseRow[]; total: number }> {
  const conditions = [eq(purchases.cardId, cardId)];
  const needle = page.query?.trim();
  if (needle) {
    const pattern = `%${needle.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    conditions.push(or(ilike(purchases.description, pattern), sql`${purchases.amount}::text like ${pattern}`)!);
  }
  const where = and(...conditions);
  const [items, [{ total }]] = await Promise.all([
    db
      .select()
      .from(purchases)
      .where(where)
      .orderBy(desc(purchases.purchaseDate), desc(purchases.createdAt))
      .limit(page.limit)
      .offset(page.offset),
    db.select({ total: count() }).from(purchases).where(where),
  ]);
  return { items, total };
}
