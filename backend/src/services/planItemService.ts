import { monthlyAmount } from '../domain/forecast';
import { findAccountById } from '../repositories/accountRepository';
import { findCardById } from '../repositories/cardRepository';
import { findCategory } from '../repositories/categoryRepository';
import {
  createPlanItem,
  deletePlanItem,
  findPlanItem,
  findPlanItemsByUserId,
  updatePlanItem,
  type PlanItemInput,
} from '../repositories/planRepository';

export class PlanItemError extends Error {}

/** The card, the target account and the category must belong to the user and fit the item kind. */
async function checkLinks(userId: string, data: Partial<PlanItemInput>, kind: PlanItemInput['kind']) {
  const links: Partial<PlanItemInput> = {};
  if (kind !== 'expense') links.cardId = null;
  else if (data.cardId) {
    const card = await findCardById(data.cardId);
    if (!card || card.userId !== userId) throw new PlanItemError('Card not found');
  }
  if (kind !== 'transfer') links.targetAccountId = null;
  else if (data.targetAccountId) {
    const account = await findAccountById(data.targetAccountId);
    if (!account || account.userId !== userId) throw new PlanItemError('Account not found');
  }
  if (kind !== 'expense') {
    links.spread = false;
    links.categoryId = null;
  } else if (data.categoryId && !(await findCategory(userId, data.categoryId))) throw new PlanItemError('Category not found');
  return { ...data, ...links };
}

export async function listPlanItems(userId: string) {
  return (await findPlanItemsByUserId(userId)).map((row) => ({ ...row, monthlyAmount: monthlyAmount(row as never) }));
}

export async function addPlanItem(userId: string, data: PlanItemInput) {
  return createPlanItem(userId, (await checkLinks(userId, data, data.kind)) as PlanItemInput);
}

export async function patchPlanItem(userId: string, id: string, data: Partial<PlanItemInput>) {
  const existing = await findPlanItem(userId, id);
  if (!existing) return null;
  const kind = data.kind ?? (existing.kind as PlanItemInput['kind']);
  return updatePlanItem(userId, id, await checkLinks(userId, { cardId: existing.cardId, targetAccountId: existing.targetAccountId, categoryId: existing.categoryId, ...data }, kind));
}

export async function removePlanItem(userId: string, id: string): Promise<boolean> {
  return deletePlanItem(userId, id);
}
