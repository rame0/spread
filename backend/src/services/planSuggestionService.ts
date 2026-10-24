import { normalizeDescription, rulePattern, stripCity } from '../domain/categorize';
import {
  categoryPlanVsFact,
  suggestPlanItems,
  type CategorizedPlanItem,
  type CategorizedPurchase,
} from '../domain/plan-suggestions';
import { addMonths } from '../domain/savings';
import {
  findCategoriesByUserId,
  findSuggestionDismissals,
  findUserPurchasesSince,
  upsertSuggestionDismissal,
  type UserPurchaseRow,
} from '../repositories/categoryRepository';
import { findPlanItemsByUserId } from '../repositories/planRepository';

/** History the suggestions look at: the subscription window plus the current month. */
const HISTORY_MONTHS = 7;

function toPurchase(row: UserPurchaseRow): CategorizedPurchase {
  return {
    date: row.purchaseDate,
    amount: row.amount,
    cardId: row.cardId,
    categoryId: row.categoryId,
    pattern: row.description ? rulePattern(row.description) || null : null,
    label: row.description ? stripCity(normalizeDescription(row.description)) : null,
  };
}

async function planItems(userId: string): Promise<CategorizedPlanItem[]> {
  return (await findPlanItemsByUserId(userId)).map((row) => ({
    ...row,
    kind: row.kind as CategorizedPlanItem['kind'],
    frequency: row.frequency as CategorizedPlanItem['frequency'],
  }));
}

export async function getPlanSuggestions(userId: string, today = new Date().toISOString().slice(0, 10)) {
  const [rows, items, dismissals, categories] = await Promise.all([
    findUserPurchasesSince(userId, addMonths(`${today.slice(0, 7)}-01`, -HISTORY_MONTHS)),
    planItems(userId),
    findSuggestionDismissals(userId),
    findCategoriesByUserId(userId),
  ]);
  const names = new Map(categories.map((category) => [category.id, category.name]));
  return suggestPlanItems(rows.map(toPurchase), items, dismissals, names, today);
}

export async function dismissPlanSuggestion(userId: string, key: string, amount: number) {
  await upsertSuggestionDismissal(userId, key, amount);
}

/** Planned versus card spending per category in a month (YYYY-MM). */
export async function getCategoryMonth(userId: string, month: string) {
  const [rows, items] = await Promise.all([findUserPurchasesSince(userId, `${month}-01`), planItems(userId)]);
  return categoryPlanVsFact(items, rows.map(toPurchase), month);
}
