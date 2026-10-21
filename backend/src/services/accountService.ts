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
import { INTEREST_KINDS } from './savingsService';

/** Interest terms belong to savings accounts and deposits only. */
function withoutForeignTerms<T extends Partial<AccountInput>>(data: T, kind: string): T {
  return INTEREST_KINDS.includes(kind) ? data : { ...data, interestMode: null, payoutDay: null, maturityDate: null };
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
  const account = await createAccount(userId, withoutForeignTerms(fields, fields.kind));
  if (initialBalance) await upsertBalance(account.id, initialBalance.date, { amount: initialBalance.amount });
  if (initialRate && INTEREST_KINDS.includes(account.kind)) {
    await createAccountEvent(account.id, { kind: 'rate_change', eventDate: initialRate.date, rate: initialRate.rate });
  }
  return account;
}

export async function patchAccount(accountId: string, userId: string, data: Partial<AccountInput>) {
  const account = await findOwned(accountId, userId);
  if (!account) return null;
  return updateAccount(accountId, withoutForeignTerms(data, data.kind ?? account.kind));
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

export async function removeBalance(accountId: string, userId: string, balanceDate: string): Promise<boolean> {
  if (!(await findOwned(accountId, userId))) return false;
  return deleteBalance(accountId, balanceDate);
}
