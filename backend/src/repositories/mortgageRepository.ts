import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { mortgageEvents, mortgages } from '../db/schema';

export type MortgageRow = typeof mortgages.$inferSelect;
export type MortgageEventRow = typeof mortgageEvents.$inferSelect;

export interface MortgageInput {
  name: string;
  principal: number;
  issueDate: string;
  annualRate: number;
  termMonths: number;
  paymentDay: number;
  firstPaymentInterestOnly: boolean;
}

export interface MortgageEventInput {
  kind: 'payment' | 'prepayment' | 'rate_change' | 'reconciliation';
  eventDate: string;
  amount?: number | null;
  prepaymentMode?: 'reduce_term' | 'reduce_payment' | null;
  newRate?: number | null;
  actualBalance?: number | null;
  note?: string | null;
}

export async function createMortgage(userId: string, data: MortgageInput, executor: any = db): Promise<MortgageRow> {
  const [row] = await executor.insert(mortgages).values({ userId, ...data }).returning();
  if (!row) throw new Error('Failed to create mortgage');
  return row;
}

export async function findMortgagesByUserId(userId: string, executor: any = db): Promise<MortgageRow[]> {
  return executor.select().from(mortgages).where(eq(mortgages.userId, userId)).orderBy(desc(mortgages.createdAt));
}

export async function findMortgageById(id: string, executor: any = db): Promise<MortgageRow | null> {
  const [row] = await executor.select().from(mortgages).where(eq(mortgages.id, id)).limit(1);
  return row ?? null;
}

export async function updateMortgage(
  id: string,
  data: Partial<MortgageInput>,
  executor: any = db
): Promise<MortgageRow | null> {
  const [row] = await executor.update(mortgages).set(data).where(eq(mortgages.id, id)).returning();
  return row ?? null;
}

export async function deleteMortgage(id: string, executor: any = db): Promise<void> {
  await executor.delete(mortgages).where(eq(mortgages.id, id));
}

export async function findEventsByMortgageId(mortgageId: string, executor: any = db): Promise<MortgageEventRow[]> {
  return executor
    .select()
    .from(mortgageEvents)
    .where(eq(mortgageEvents.mortgageId, mortgageId))
    .orderBy(asc(mortgageEvents.eventDate), asc(mortgageEvents.createdAt));
}

export async function createMortgageEvents(
  mortgageId: string,
  events: MortgageEventInput[],
  executor: any = db
): Promise<MortgageEventRow[]> {
  if (events.length === 0) return [];
  return executor
    .insert(mortgageEvents)
    .values(events.map((event) => ({ mortgageId, ...event })))
    .returning();
}

export async function deleteMortgageEvent(mortgageId: string, eventId: string, executor: any = db): Promise<boolean> {
  const rows = await executor
    .delete(mortgageEvents)
    .where(and(eq(mortgageEvents.mortgageId, mortgageId), eq(mortgageEvents.id, eventId)))
    .returning({ id: mortgageEvents.id });
  return rows.length > 0;
}
