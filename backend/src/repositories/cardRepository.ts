import { eq } from 'drizzle-orm';
import { db } from '../db';
import { cards } from '../db/schema';

export type CardRow = typeof cards.$inferSelect;
export type CardInsert = typeof cards.$inferInsert;

export async function createCard(
  userId: string,
  data: { name: string; reportDay: number; gracePeriods?: number; graceDueDay?: number }
): Promise<CardRow> {
  const graceDueDay = data.graceDueDay ?? data.reportDay;
  const gracePeriods = data.gracePeriods ?? 4;
  const [row] = await db
    .insert(cards)
    .values({
      userId,
      name: data.name,
      reportDay: data.reportDay,
      gracePeriods,
      graceDueDay,
    })
    .returning();
  if (!row) throw new Error('Failed to create card');
  return row;
}

export async function findCardsByUserId(userId: string): Promise<CardRow[]> {
  return db.select().from(cards).where(eq(cards.userId, userId));
}

export async function findCardById(id: string): Promise<CardRow | null> {
  const [row] = await db.select().from(cards).where(eq(cards.id, id)).limit(1);
  return row ?? null;
}

export async function updateCardSettings(
  id: string,
  data: Partial<{ reportDay: number; gracePeriods: number; graceDueDay: number }>
): Promise<CardRow | null> {
  const [row] = await db
    .update(cards)
    .set(data as Record<string, number>)
    .where(eq(cards.id, id))
    .returning();
  return row ?? null;
}
