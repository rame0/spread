import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { accountPortfolios, integrations } from '../db/schema';

export type IntegrationRow = typeof integrations.$inferSelect;
export type AccountPortfolioRow = typeof accountPortfolios.$inferSelect;

export async function findIntegration(userId: string, provider: string, executor: any = db): Promise<IntegrationRow | null> {
  const [row] = await executor
    .select()
    .from(integrations)
    .where(and(eq(integrations.userId, userId), eq(integrations.provider, provider)))
    .limit(1);
  return row ?? null;
}

export async function findIntegrationsByProvider(provider: string, executor: any = db): Promise<IntegrationRow[]> {
  return executor.select().from(integrations).where(eq(integrations.provider, provider));
}

export async function saveIntegration(userId: string, provider: string, tokenEncrypted: string, executor: any = db): Promise<void> {
  const values = { tokenEncrypted, lastError: null, lastSyncAt: null };
  await executor
    .insert(integrations)
    .values({ userId, provider, ...values })
    .onConflictDoUpdate({ target: [integrations.userId, integrations.provider], set: values });
}

export async function updateIntegrationSync(
  userId: string,
  provider: string,
  data: { lastSyncAt?: Date; lastError: string | null },
  executor: any = db
): Promise<void> {
  await executor
    .update(integrations)
    .set(data)
    .where(and(eq(integrations.userId, userId), eq(integrations.provider, provider)));
}

export async function deleteIntegration(userId: string, provider: string, executor: any = db): Promise<boolean> {
  const rows = await executor
    .delete(integrations)
    .where(and(eq(integrations.userId, userId), eq(integrations.provider, provider)))
    .returning({ userId: integrations.userId });
  return rows.length > 0;
}

export async function findPortfolio(accountId: string, executor: any = db): Promise<AccountPortfolioRow | null> {
  const [row] = await executor.select().from(accountPortfolios).where(eq(accountPortfolios.accountId, accountId)).limit(1);
  return row ?? null;
}

export async function savePortfolio(accountId: string, data: unknown, executor: any = db): Promise<void> {
  const values = { syncedAt: new Date(), data };
  await executor
    .insert(accountPortfolios)
    .values({ accountId, ...values })
    .onConflictDoUpdate({ target: accountPortfolios.accountId, set: values });
}
