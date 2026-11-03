import { asc, eq } from 'drizzle-orm';
import { db } from '../db';
import { taxYears } from '../db/schema';

export type TaxYearRow = typeof taxYears.$inferSelect;

export interface TaxYearInput {
  annualIncome: number | null;
  otherDeductible: number;
  refundReceived: number | null;
}

export async function findTaxYearsByUserId(userId: string, executor: any = db): Promise<TaxYearRow[]> {
  return executor.select().from(taxYears).where(eq(taxYears.userId, userId)).orderBy(asc(taxYears.year));
}

export async function upsertTaxYear(userId: string, year: number, data: TaxYearInput, executor: any = db): Promise<TaxYearRow> {
  const values = { ...data, updatedAt: new Date() };
  const [row] = await executor
    .insert(taxYears)
    .values({ userId, year, ...values })
    .onConflictDoUpdate({ target: [taxYears.userId, taxYears.year], set: values })
    .returning();
  if (!row) throw new Error('Failed to save tax year');
  return row;
}
