/**
 * Plan items suggested from categorised card purchases, and the plan versus actual spending of
 * each category in a month.
 */
import { monthlyAmount, occurrences, type PlanItem } from './forecast';
import { addMonths } from './savings';

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export interface CategorizedPurchase {
  date: string;
  amount: number;
  cardId: string;
  categoryId: string | null;
  /** Rule pattern of the description; purchases with the same one are the same merchant. */
  pattern: string | null;
  label: string | null;
}

export interface CategorizedPlanItem extends PlanItem {
  name: string;
  currency: string;
  categoryId: string | null;
  sourcePattern: string | null;
}

export interface PlanSuggestion {
  /** subscription:<pattern> or budget:<categoryId>; a dismissal is stored under it. */
  key: string;
  action: 'add' | 'update';
  kind: 'subscription' | 'budget';
  name: string;
  categoryId: string | null;
  amount: number;
  cardId: string | null;
  startDate: string;
  spread: boolean;
  sourcePattern: string | null;
  /** The item to update and its current amount. */
  planItemId: string | null;
  currentAmount: number | null;
  /** Monthly totals the suggestion is based on, oldest first. */
  months: { month: string; amount: number }[];
}

export interface Dismissal {
  key: string;
  amount: number;
}

/** A charge needs this many months to count as a subscription. */
const SUBSCRIPTION_MONTHS = 3;
/** Months of history a subscription is looked for in, before the current one. */
const SUBSCRIPTION_WINDOW = 6;
/** A subscription not charged for this long has probably been cancelled. */
const SUBSCRIPTION_STALE_DAYS = 40;
/** Largest to smallest charge of a subscription; prices change, but not by much. */
const SUBSCRIPTION_SPREAD = 1.25;
/** Full months a category must be spent in every one of to get a budget. */
const BUDGET_MONTHS = 3;
const BUDGET_MIN_AMOUNT = 500;
/** A plan amount this close to the actual median is left alone. */
const UPDATE_TOLERANCE = 0.15;
/** A dismissed suggestion comes back once its amount moves this much. */
const DISMISS_TOLERANCE = 0.15;

const monthOf = (date: string) => date.slice(0, 7);
const dayMs = 24 * 60 * 60 * 1000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / dayMs);

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** The n full months before today's month, oldest first, as YYYY-MM. */
function fullMonths(today: string, n: number): string[] {
  const first = `${monthOf(today)}-01`;
  return Array.from({ length: n }, (_, i) => monthOf(addMonths(first, i - n)));
}

const differs = (a: number, b: number, tolerance: number) => Math.abs(a - b) > tolerance * Math.max(Math.abs(a), Math.abs(b));

function dismissed(suggestion: PlanSuggestion, dismissals: Dismissal[]): boolean {
  const dismissal = dismissals.find((row) => row.key === suggestion.key);
  return !!dismissal && !differs(dismissal.amount, suggestion.amount, DISMISS_TOLERANCE);
}

function mostCommon<T>(values: T[]): T {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** Charges by one merchant once a month at a steady price: a subscription, a phone bill, rent. */
function subscriptions(purchases: CategorizedPurchase[], items: CategorizedPlanItem[], today: string): PlanSuggestion[] {
  const since = `${fullMonths(today, SUBSCRIPTION_WINDOW)[0]}-01`;
  const byPattern = new Map<string, CategorizedPurchase[]>();
  for (const purchase of purchases) {
    if (!purchase.pattern || purchase.date < since || purchase.date > today) continue;
    byPattern.set(purchase.pattern, [...(byPattern.get(purchase.pattern) ?? []), purchase]);
  }
  const result: PlanSuggestion[] = [];
  for (const [pattern, rows] of byPattern) {
    rows.sort((a, b) => a.date.localeCompare(b.date));
    const months = new Map<string, number>();
    for (const row of rows) months.set(monthOf(row.date), (months.get(monthOf(row.date)) ?? 0) + 1);
    if (months.size < SUBSCRIPTION_MONTHS || [...months.values()].some((count) => count > 1)) continue;
    const amounts = rows.map((row) => row.amount);
    if (Math.max(...amounts) > SUBSCRIPTION_SPREAD * Math.min(...amounts)) continue;
    const last = rows[rows.length - 1];
    if (daysBetween(last.date, today) > SUBSCRIPTION_STALE_DAYS) continue;

    const linked = items.find((item) => item.sourcePattern === pattern);
    const base = {
      key: `subscription:${pattern}`,
      kind: 'subscription' as const,
      name: last.label || pattern,
      categoryId: last.categoryId,
      amount: last.amount,
      cardId: last.cardId,
      startDate: addMonths(last.date, 1),
      spread: false,
      sourcePattern: pattern,
      months: rows.map((row) => ({ month: monthOf(row.date), amount: row.amount })),
    };
    if (!linked) result.push({ ...base, action: 'add', planItemId: null, currentAmount: null });
    else if (differs(linked.amount, last.amount, 0.02)) {
      result.push({ ...base, action: 'update', planItemId: linked.id, currentAmount: linked.amount });
    }
  }
  return result;
}

/**
 * A category spent on every recent month: its typical monthly total, less what other plan items
 * of the category (subscriptions, say) already cover.
 */
function budgets(purchases: CategorizedPurchase[], items: CategorizedPlanItem[], today: string, names: Map<string, string>): PlanSuggestion[] {
  const months = fullMonths(today, BUDGET_MONTHS);
  const totals = new Map<string, Map<string, number>>();
  const cards = new Map<string, string[]>();
  for (const purchase of purchases) {
    const month = monthOf(purchase.date);
    if (!purchase.categoryId || !months.includes(month)) continue;
    const byMonth = totals.get(purchase.categoryId) ?? new Map<string, number>();
    byMonth.set(month, (byMonth.get(month) ?? 0) + purchase.amount);
    totals.set(purchase.categoryId, byMonth);
    cards.set(purchase.categoryId, [...(cards.get(purchase.categoryId) ?? []), purchase.cardId]);
  }
  const result: PlanSuggestion[] = [];
  for (const [categoryId, byMonth] of totals) {
    if (byMonth.size < BUDGET_MONTHS || !names.has(categoryId)) continue;
    const typical = median([...byMonth.values()]);
    const own = items.filter((item) => item.kind === 'expense' && item.categoryId === categoryId && item.currency === 'RUB');
    const budget = own.find((item) => !item.sourcePattern && item.frequency === 'monthly' && item.interval === 1);
    const others = own.filter((item) => item !== budget).reduce((sum, item) => sum + monthlyAmount(item), 0);
    const amount = Math.round((typical - others) / 100) * 100;
    if (amount < BUDGET_MIN_AMOUNT) continue;
    const base = {
      key: `budget:${categoryId}`,
      kind: 'budget' as const,
      name: names.get(categoryId)!,
      categoryId,
      amount,
      cardId: mostCommon(cards.get(categoryId)!),
      startDate: `${monthOf(today)}-01`,
      spread: true,
      sourcePattern: null,
      months: months.map((month) => ({ month, amount: round2(byMonth.get(month) ?? 0) })),
    };
    if (!budget) {
      if (!own.length || differs(others, typical, UPDATE_TOLERANCE)) result.push({ ...base, action: 'add', planItemId: null, currentAmount: null });
    } else if (differs(budget.amount, amount, UPDATE_TOLERANCE)) {
      result.push({ ...base, action: 'update', planItemId: budget.id, currentAmount: budget.amount, startDate: budget.startDate, cardId: budget.cardId });
    }
  }
  return result;
}

export function suggestPlanItems(
  purchases: CategorizedPurchase[],
  items: CategorizedPlanItem[],
  dismissals: Dismissal[],
  categoryNames: Map<string, string>,
  today: string
): PlanSuggestion[] {
  return [...subscriptions(purchases, items, today), ...budgets(purchases, items, today, categoryNames)]
    .filter((suggestion) => !dismissed(suggestion, dismissals))
    .sort((a, b) => b.amount - a.amount);
}

export interface CategoryMonthRow {
  categoryId: string | null;
  plan: number;
  fact: number;
}

/** Planned expenses and card purchases of each category within a month; null is uncategorised. */
export function categoryPlanVsFact(items: CategorizedPlanItem[], purchases: CategorizedPurchase[], month: string): CategoryMonthRow[] {
  const from = `${month}-01`;
  const to = addMonths(from, 1);
  const rows = new Map<string | null, CategoryMonthRow>();
  const row = (categoryId: string | null) => {
    let found = rows.get(categoryId);
    if (!found) {
      found = { categoryId, plan: 0, fact: 0 };
      rows.set(categoryId, found);
    }
    return found;
  };
  for (const item of items) {
    if (item.kind !== 'expense' || item.currency !== 'RUB') continue;
    const total = occurrences(item, from, to).filter((occurrence) => occurrence.date < to).reduce((sum, occurrence) => sum + occurrence.amount, 0);
    if (total > 0) row(item.categoryId).plan += total;
  }
  for (const purchase of purchases) if (purchase.date >= from && purchase.date < to) row(purchase.categoryId).fact += purchase.amount;
  return [...rows.values()]
    .map((value) => ({ ...value, plan: round2(value.plan), fact: round2(value.fact) }))
    .sort((a, b) => Math.max(b.plan, b.fact) - Math.max(a.plan, a.fact));
}
