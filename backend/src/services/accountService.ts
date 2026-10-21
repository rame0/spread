import {
  createAccount,
  deleteAccount,
  deleteBalance,
  findAccountById,
  findAccountsByUserId,
  findBalancesByAccountIds,
  updateAccount,
  upsertBalance,
  type AccountInput,
} from '../repositories/accountRepository';

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

/** Creates the account and, when given, its first balance snapshot. */
export async function addAccount(
  userId: string,
  data: AccountInput & { initialBalance?: { date: string; amount: number } }
) {
  const { initialBalance, ...fields } = data;
  const account = await createAccount(userId, fields);
  if (initialBalance) await upsertBalance(account.id, initialBalance.date, { amount: initialBalance.amount });
  return account;
}

export async function patchAccount(accountId: string, userId: string, data: Partial<AccountInput>) {
  if (!(await findOwned(accountId, userId))) return null;
  return updateAccount(accountId, data);
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
