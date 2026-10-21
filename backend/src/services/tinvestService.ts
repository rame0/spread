import { decryptSecret, encryptSecret } from '../auth/secretBox';
import { isOpenAccount, toPortfolioStructure, type TinvestAccount } from '../domain/tinvest';
import { createAccount, findAccountsByUserId, upsertBalance, type AccountRow } from '../repositories/accountRepository';
import {
  deleteIntegration,
  findIntegration,
  findIntegrationsByProvider,
  findPortfolio,
  saveIntegration,
  savePortfolio,
  updateIntegrationSync,
} from '../repositories/integrationRepository';
import { logger } from '../logging';
import { getTinvestAccounts, getTinvestPortfolio, TinvestError } from './tinvestClient';

export const PROVIDER = 'tinvest';
/** Portfolios are synced on start and then every few hours. */
export const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

export class TinvestTokenError extends Error {}

function describe(error: unknown): string {
  if (error instanceof TinvestError && (error.status === 401 || error.status === 403)) return 'Token is invalid or revoked';
  return error instanceof Error ? error.message.slice(0, 500) : 'Unknown error';
}

async function tokenOf(userId: string): Promise<string | null> {
  const integration = await findIntegration(userId, PROVIDER);
  if (!integration) return null;
  try {
    return decryptSecret(integration.tokenEncrypted);
  } catch {
    await updateIntegrationSync(userId, PROVIDER, { lastError: 'Stored token cannot be decrypted, enter it again' });
    return null;
  }
}

const linkedAccounts = (accounts: AccountRow[]) => accounts.filter((account) => account.externalSource === PROVIDER && account.externalId);

export interface TinvestStatus {
  connected: boolean;
  lastSyncAt: Date | null;
  lastError: string | null;
  /** Open T-Bank accounts with the app account each is linked to; empty when the API is unreachable. */
  accounts: Array<{ id: string; name: string; type: string; linkedAccountId: string | null }>;
}

export async function getStatus(userId: string): Promise<TinvestStatus> {
  const integration = await findIntegration(userId, PROVIDER);
  if (!integration) return { connected: false, lastSyncAt: null, lastError: null, accounts: [] };
  const token = await tokenOf(userId);
  const linked = linkedAccounts(await findAccountsByUserId(userId));
  let remote: TinvestAccount[] = [];
  let lastError = integration.lastError;
  if (token) {
    try {
      remote = (await getTinvestAccounts(token)).filter(isOpenAccount);
    } catch (error) {
      lastError = describe(error);
    }
  }
  return {
    connected: true,
    lastSyncAt: integration.lastSyncAt,
    lastError: token ? lastError : 'Stored token cannot be decrypted, enter it again',
    accounts: remote.map((account) => ({
      id: account.id,
      name: account.name,
      type: account.type,
      linkedAccountId: linked.find((row) => row.externalId === account.id)?.id ?? null,
    })),
  };
}

/** Checks the token against the API before storing it encrypted. */
export async function connect(userId: string, token: string): Promise<void> {
  try {
    await getTinvestAccounts(token);
  } catch (error) {
    throw new TinvestTokenError(describe(error));
  }
  await saveIntegration(userId, PROVIDER, encryptSecret(token));
}

/** Forgets the token; linked accounts stay with their history and become manual. */
export async function disconnect(userId: string): Promise<boolean> {
  return deleteIntegration(userId, PROVIDER);
}

/** Creates a brokerage account for the T-Bank account and syncs it right away. */
export async function linkAccount(userId: string, externalId: string) {
  const token = await tokenOf(userId);
  if (!token) return null;
  const remote = (await getTinvestAccounts(token)).find((account) => account.id === externalId && isOpenAccount(account));
  if (!remote) return null;
  const existing = linkedAccounts(await findAccountsByUserId(userId)).find((account) => account.externalId === externalId);
  if (existing) return existing;
  const account = await createAccount(userId, {
    name: remote.name || `Т-Банк ${externalId}`,
    kind: 'brokerage',
    currency: 'RUB',
    institution: 'Т-Банк',
    isLiquid: false,
    externalSource: PROVIDER,
    externalId,
  });
  await sync(userId);
  return account;
}

/** Saves today's portfolio value and structure of every linked account. */
export async function sync(userId: string): Promise<{ synced: number; error: string | null }> {
  const token = await tokenOf(userId);
  if (!token) return { synced: 0, error: 'Not connected' };
  const today = new Date().toISOString().slice(0, 10);
  let synced = 0;
  let error: string | null = null;
  for (const account of linkedAccounts(await findAccountsByUserId(userId))) {
    if (account.archivedAt) continue;
    try {
      const structure = toPortfolioStructure(await getTinvestPortfolio(token, account.externalId!));
      await upsertBalance(account.id, today, { amount: structure.total, note: 'Т-Банк' });
      await savePortfolio(account.id, structure);
      synced++;
    } catch (failure) {
      error = describe(failure);
      logger.warn({ err: failure, accountId: account.id }, 'Failed to sync T-Bank portfolio');
    }
  }
  await updateIntegrationSync(userId, PROVIDER, error ? { lastError: error } : { lastSyncAt: new Date(), lastError: null });
  return { synced, error };
}

export async function syncAll(): Promise<void> {
  for (const integration of await findIntegrationsByProvider(PROVIDER)) {
    try {
      await sync(integration.userId);
    } catch (error) {
      logger.warn({ err: error, userId: integration.userId }, 'T-Bank sync failed');
    }
  }
}

export async function getPortfolio(account: AccountRow) {
  if (account.externalSource !== PROVIDER) return null;
  return findPortfolio(account.id);
}
