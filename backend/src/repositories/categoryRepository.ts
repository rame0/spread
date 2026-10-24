import { and, asc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { cards, categories, categoryReferenceMap, categoryRules, planSuggestionDismissals, purchases, users } from '../db/schema';

export type CategoryRow = typeof categories.$inferSelect;
export type CategoryRuleRow = typeof categoryRules.$inferSelect;

export async function findCategoriesByUserId(userId: string, executor: any = db): Promise<CategoryRow[]> {
  return executor.select().from(categories).where(eq(categories.userId, userId)).orderBy(asc(categories.name));
}

export async function findCategory(userId: string, id: string, executor: any = db): Promise<CategoryRow | null> {
  const [row] = await executor.select().from(categories).where(and(eq(categories.userId, userId), eq(categories.id, id))).limit(1);
  return row ?? null;
}

export async function createCategory(userId: string, name: string, executor: any = db): Promise<CategoryRow> {
  const [row] = await executor.insert(categories).values({ userId, name }).returning();
  if (!row) throw new Error('Failed to create category');
  return row;
}

export async function renameCategory(userId: string, id: string, name: string, executor: any = db): Promise<CategoryRow | null> {
  const [row] = await executor.update(categories).set({ name }).where(and(eq(categories.userId, userId), eq(categories.id, id))).returning();
  return row ?? null;
}

export async function deleteCategory(userId: string, id: string, executor: any = db): Promise<boolean> {
  const rows = await executor
    .delete(categories)
    .where(and(eq(categories.userId, userId), eq(categories.id, id)))
    .returning({ id: categories.id });
  return rows.length > 0;
}

/** Marks the user as seeded; true only for the one caller that flipped the flag. */
export async function claimCategorySeeding(userId: string, executor: any = db): Promise<boolean> {
  const rows = await executor
    .update(users)
    .set({ categoriesSeeded: true })
    .where(and(eq(users.id, userId), eq(users.categoriesSeeded, false)))
    .returning({ id: users.id });
  return rows.length > 0;
}

export async function findReferenceMap(userId: string, executor: any = db): Promise<{ referenceCategory: string; categoryId: string }[]> {
  return executor
    .select({ referenceCategory: categoryReferenceMap.referenceCategory, categoryId: categoryReferenceMap.categoryId })
    .from(categoryReferenceMap)
    .where(eq(categoryReferenceMap.userId, userId));
}

/** Points these reference categories at the category, taking them away from any other. */
export async function assignReferenceCategories(userId: string, categoryId: string, referenceCategories: string[], executor: any = db) {
  await executor.delete(categoryReferenceMap).where(and(eq(categoryReferenceMap.userId, userId), eq(categoryReferenceMap.categoryId, categoryId)));
  if (referenceCategories.length === 0) return;
  await executor
    .insert(categoryReferenceMap)
    .values(referenceCategories.map((referenceCategory) => ({ userId, referenceCategory, categoryId })))
    .onConflictDoUpdate({
      target: [categoryReferenceMap.userId, categoryReferenceMap.referenceCategory],
      set: { categoryId },
    });
}

export async function findRulesByUserId(userId: string, executor: any = db): Promise<CategoryRuleRow[]> {
  return executor.select().from(categoryRules).where(eq(categoryRules.userId, userId));
}

export async function upsertRule(
  userId: string,
  data: { pattern: string; categoryId: string; embedding: number[] | null; modelVersion: string | null },
  executor: any = db
) {
  await executor
    .insert(categoryRules)
    .values({ userId, ...data })
    .onConflictDoUpdate({
      target: [categoryRules.userId, categoryRules.pattern],
      set: { categoryId: data.categoryId, embedding: data.embedding, modelVersion: data.modelVersion, updatedAt: new Date() },
    });
}

export async function updateRuleEmbedding(id: string, embedding: number[], modelVersion: string, executor: any = db) {
  await executor.update(categoryRules).set({ embedding, modelVersion }).where(eq(categoryRules.id, id));
}

export interface UserPurchaseRow {
  id: string;
  cardId: string;
  cardName: string;
  purchaseDate: string;
  amount: number;
  description: string | null;
  categoryId: string | null;
  categorySource: string | null;
}

const userPurchaseColumns = {
  id: purchases.id,
  cardId: purchases.cardId,
  cardName: cards.name,
  purchaseDate: purchases.purchaseDate,
  amount: purchases.amount,
  description: purchases.description,
  categoryId: purchases.categoryId,
  categorySource: purchases.categorySource,
};

/** Purchases of all the user's cards the user has not categorised themselves. */
export async function findPurchasesNotSetByUser(userId: string, executor: any = db): Promise<UserPurchaseRow[]> {
  return executor
    .select(userPurchaseColumns)
    .from(purchases)
    .innerJoin(cards, eq(cards.id, purchases.cardId))
    .where(and(eq(cards.userId, userId), or(isNull(purchases.categorySource), sql`${purchases.categorySource} <> 'user'`)))
    .orderBy(sql`${purchases.purchaseDate} desc`);
}

/** Without a category and not left without one on purpose. */
export async function findUncategorizedPurchases(userId: string, executor: any = db): Promise<UserPurchaseRow[]> {
  return executor
    .select(userPurchaseColumns)
    .from(purchases)
    .innerJoin(cards, eq(cards.id, purchases.cardId))
    .where(and(eq(cards.userId, userId), isNull(purchases.categoryId), isNull(purchases.categorySource)))
    .orderBy(sql`${purchases.purchaseDate} desc`);
}

export async function findUserPurchase(userId: string, cardId: string, purchaseId: string, executor: any = db) {
  const [row] = await executor
    .select(userPurchaseColumns)
    .from(purchases)
    .innerJoin(cards, eq(cards.id, purchases.cardId))
    .where(and(eq(cards.userId, userId), eq(purchases.cardId, cardId), eq(purchases.id, purchaseId)))
    .limit(1);
  return (row as UserPurchaseRow | undefined) ?? null;
}

export async function setPurchaseCategories(
  ids: string[],
  data: { categoryId: string | null; categorySource: string | null; categoryMargin: number | null },
  executor: any = db
) {
  if (ids.length === 0) return;
  await executor.update(purchases).set(data).where(inArray(purchases.id, ids));
}

/** Purchases of all the user's cards from a date on. */
export async function findUserPurchasesSince(userId: string, from: string, executor: any = db): Promise<UserPurchaseRow[]> {
  return executor
    .select(userPurchaseColumns)
    .from(purchases)
    .innerJoin(cards, eq(cards.id, purchases.cardId))
    .where(and(eq(cards.userId, userId), gte(purchases.purchaseDate, from)))
    .orderBy(asc(purchases.purchaseDate));
}

export async function findSuggestionDismissals(userId: string, executor: any = db): Promise<{ key: string; amount: number }[]> {
  return executor
    .select({ key: planSuggestionDismissals.key, amount: planSuggestionDismissals.amount })
    .from(planSuggestionDismissals)
    .where(eq(planSuggestionDismissals.userId, userId));
}

export async function upsertSuggestionDismissal(userId: string, key: string, amount: number, executor: any = db) {
  await executor
    .insert(planSuggestionDismissals)
    .values({ userId, key, amount })
    .onConflictDoUpdate({ target: [planSuggestionDismissals.userId, planSuggestionDismissals.key], set: { amount, createdAt: new Date() } });
}
