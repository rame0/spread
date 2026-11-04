import {
  createAccount,
  createAccountEvent,
  deleteAccount,
  deleteBalance,
  findAccountById,
  findAccountsByUserId,
  findBalancesByAccountIds,
  updateAccount,
  upsertBalance,
  type AccountInput,
} from '../repositories/accountRepository';
import { db } from '../db';
import { BENEFIT_KINDS, defaultUnlockDate, findRuleset, rulesetsFor } from '../domain/tax-benefit-rules';
import { INTEREST_KINDS } from './savingsService';

export class AccountRulesError extends Error {}

/**
 * Interest terms belong to savings accounts and deposits only, the opening date and the
 * rules to ПДС and ИИС, whose money is never free and never a card reserve.
 */
function withoutForeignTerms<T extends Partial<AccountInput>>(data: T, kind: string): T {
  const result = INTEREST_KINDS.includes(kind) ? { ...data } : { ...data, interestMode: null, payoutDay: null, maturityDate: null };
  if (BENEFIT_KINDS.includes(kind)) return { ...result, isLiquid: false, isCardReserve: false };
  return { ...result, openedAt: null, ruleset: null, unlockDate: null };
}

/**
 * Checks the rules of a ПДС or ИИС against its opening date. The unlock date follows the
 * rules unless given; `changed` tells whether the date or the rules were just changed.
 */
function withRules<T extends Partial<AccountInput>>(data: T, current: Pick<AccountInput, 'kind' | 'openedAt' | 'ruleset'>, changed: boolean): T {
  if (!BENEFIT_KINDS.includes(current.kind)) return data;
  const { openedAt, ruleset: id } = current;
  if (!openedAt) throw new AccountRulesError('The opening date is required');
  // A synced ИИС may wait for the user to pick its type.
  if (!id) return data;
  if (!rulesetsFor(current.kind, openedAt).some((ruleset) => ruleset.id === id)) {
    throw new AccountRulesError('The rules do not apply to an account of this kind opened on this date');
  }
  if (data.unlockDate !== undefined || !changed) return data;
  return { ...data, unlockDate: defaultUnlockDate(findRuleset(id)!, openedAt) };
}

async function findOwned(accountId: string, userId: string) {
  const account = await findAccountById(accountId);
  return account && account.userId === userId ? account : null;
}

export async function listAccounts(userId: string) {
  return findAccountsByUserId(userId);
}

export async function getAccount(accountId: string, userId: string) {
  return findOwned(accountId, userId);
}

/** Creates the account and, when given, its first balance snapshot and interest rate. */
export async function addAccount(
  userId: string,
  data: AccountInput & { initialBalance?: { date: string; amount: number }; initialRate?: { date: string; rate: number } }
) {
  const { initialBalance, initialRate, ...fields } = data;
  const checked = withRules(fields, fields, true);
  const account = await createAccount(userId, withoutForeignTerms(checked, fields.kind));
  if (initialBalance) await upsertBalance(account.id, initialBalance.date, { amount: initialBalance.amount });
  if (initialRate && INTEREST_KINDS.includes(account.kind)) {
    await createAccountEvent(account.id, { kind: 'rate_change', eventDate: initialRate.date, rate: initialRate.rate });
  }
  return account;
}

export async function patchAccount(accountId: string, userId: string, data: Partial<AccountInput>) {
  const account = await findOwned(accountId, userId);
  if (!account) return null;
  const kind = data.kind ?? (account.kind as AccountInput['kind']);
  const merged = { kind, openedAt: data.openedAt !== undefined ? data.openedAt : account.openedAt, ruleset: data.ruleset !== undefined ? data.ruleset : account.ruleset };
  const changed = merged.kind !== account.kind || merged.openedAt !== account.openedAt || merged.ruleset !== account.ruleset;
  return updateAccount(accountId, withoutForeignTerms(withRules(data, merged, changed), kind));
}

export async function removeAccount(accountId: string, userId: string): Promise<boolean> {
  if (!(await findOwned(accountId, userId))) return false;
  await deleteAccount(accountId);
  return true;
}

export async function getBalances(accountId: string, userId: string) {
  if (!(await findOwned(accountId, userId))) return null;
  return findBalancesByAccountIds([accountId]);
}

export async function saveBalance(
  accountId: string,
  userId: string,
  balanceDate: string,
  data: { amount: number; note?: string | null }
) {
  if (!(await findOwned(accountId, userId))) return null;
  return upsertBalance(accountId, balanceDate, data);
}

/**
 * Balances of several accounts for one date, saved together or not at all.
 * Returns null when any of the accounts is not the user's.
 */
export async function saveBalances(userId: string, balanceDate: string, entries: Array<{ accountId: string; amount: number }>) {
  const owned = new Set((await findAccountsByUserId(userId)).map((account) => account.id));
  if (entries.some((entry) => !owned.has(entry.accountId))) return null;
  return db.transaction(async (tx) =>
    Promise.all(entries.map((entry) => upsertBalance(entry.accountId, balanceDate, { amount: entry.amount }, tx)))
  );
}

export async function removeBalance(accountId: string, userId: string, balanceDate: string): Promise<boolean> {
  if (!(await findOwned(accountId, userId))) return false;
  return deleteBalance(accountId, balanceDate);
}
