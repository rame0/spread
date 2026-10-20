import { desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { cards } from '../db/schema';
import { resolveCardSettings, type CardSettingsInput } from '../domain/card-grace';

export type CardRow = typeof cards.$inferSelect;
export type CardInsert = typeof cards.$inferInsert;
export type CardKind = 'credit' | 'installment';

/** Installment cards have no grace period; these values only satisfy NOT NULL columns. */
const INSTALLMENT_SETTINGS = {
  reportDay: 1,
  graceModel: 'statement_periods',
  gracePeriods: 1,
  graceDueDay: 1,
  graceStatementPeriods: 1,
  paymentDueOffsetDays: 0,
} as const;

export async function createCard(
  userId: string,
  data: CardSettingsInput & { name: string; kind?: CardKind },
  executor: any = db
): Promise<CardRow> {
  const kind = data.kind ?? 'credit';
  const settings = kind === 'installment' ? INSTALLMENT_SETTINGS : resolveCardSettings(data);
  const [row] = await executor
    .insert(cards)
    .values({
      userId,
      name: data.name,
      kind,
      reportDay: settings.reportDay,
      graceModel: settings.graceModel,
      gracePeriods: settings.gracePeriods,
      graceDueDay: settings.graceDueDay,
      graceStatementPeriods: settings.graceStatementPeriods,
      paymentDueOffsetDays: settings.paymentDueOffsetDays,
    })
    .returning();
  if (!row) throw new Error('Failed to create card');
  return row;
}

export async function findCardsByUserId(userId: string): Promise<CardRow[]> {
  return db
    .select()
    .from(cards)
    .where(eq(cards.userId, userId))
    .orderBy(desc(cards.createdAt));
}

export async function findCardById(
  id: string,
  executor: any = db
): Promise<CardRow | null> {
  const [row] = await executor.select().from(cards).where(eq(cards.id, id)).limit(1);
  return row ?? null;
}

export async function updateCardSettings(
  id: string,
  data: Partial<{
    reportDay: number;
    graceModel: string;
    gracePeriods: number;
    graceDueDay: number;
    graceStatementPeriods: number;
    paymentDueOffsetDays: number;
  }>,
  executor: any = db
): Promise<CardRow | null> {
  const [row] = await executor
    .update(cards)
    .set(data as Record<string, number | string>)
    .where(eq(cards.id, id))
    .returning();
  return row ?? null;
}
