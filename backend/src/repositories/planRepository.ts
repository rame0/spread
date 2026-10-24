import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db';
import { planItems } from '../db/schema';

export type PlanItemRow = typeof planItems.$inferSelect;

export interface PlanItemInput {
  name: string;
  kind: 'income' | 'expense' | 'transfer';
  amount: number;
  currency: string;
  frequency: 'once' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  startDate: string;
  endDate?: string | null;
  spread: boolean;
  cardId?: string | null;
  targetAccountId?: string | null;
  note?: string | null;
  categoryId?: string | null;
  sourcePattern?: string | null;
}

export async function findPlanItemsByUserId(userId: string, executor: any = db): Promise<PlanItemRow[]> {
  return executor.select().from(planItems).where(eq(planItems.userId, userId)).orderBy(asc(planItems.createdAt));
}

export async function findPlanItem(userId: string, id: string, executor: any = db): Promise<PlanItemRow | null> {
  const [row] = await executor.select().from(planItems).where(and(eq(planItems.userId, userId), eq(planItems.id, id))).limit(1);
  return row ?? null;
}

export async function createPlanItem(userId: string, data: PlanItemInput, executor: any = db): Promise<PlanItemRow> {
  const [row] = await executor.insert(planItems).values({ userId, ...data }).returning();
  if (!row) throw new Error('Failed to create plan item');
  return row;
}

export async function updatePlanItem(userId: string, id: string, data: Partial<PlanItemInput>, executor: any = db): Promise<PlanItemRow | null> {
  const [row] = await executor.update(planItems).set(data).where(and(eq(planItems.userId, userId), eq(planItems.id, id))).returning();
  return row ?? null;
}

export async function deletePlanItem(userId: string, id: string, executor: any = db): Promise<boolean> {
  const rows = await executor
    .delete(planItems)
    .where(and(eq(planItems.userId, userId), eq(planItems.id, id)))
    .returning({ id: planItems.id });
  return rows.length > 0;
}
