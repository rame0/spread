import { db } from '../db';
import { config } from '../config/env';
import { logger } from '../logging';
import { embeddingText, nearestCategory, rulePattern, type Neighbour } from '../domain/categorize';
import { embed, modelVersion } from './categorize/encoder';
import { loadReferenceVectors, referenceCategories } from './categorize/reference';
import {
  assignReferenceCategories,
  claimCategorySeeding,
  createCategory as insertCategory,
  deleteCategory as removeCategory,
  findCategoriesByUserId,
  findCategory,
  findPurchasesNotSetByUser,
  findReferenceMap,
  findRulesByUserId,
  findUncategorizedPurchases,
  findUserPurchase,
  renameCategory,
  setPurchaseCategories,
  updateRuleEmbedding,
  upsertRule,
  type CategoryRow,
  type CategoryRuleRow,
} from '../repositories/categoryRepository';

export class CategoryError extends Error {}

/** Has no reference examples: only the user's own confirmations ever lead to it. */
const FALLBACK_CATEGORY = 'Прочее';

export interface CategorySuggestion {
  categoryId: string;
  source: 'rule' | 'model';
  margin: number | null;
  /** An exact rule, or the model above the margin threshold: safe to assign without asking. */
  confident: boolean;
}

interface UserContext {
  categories: CategoryRow[];
  /** Reference category → the user's category its examples count for. */
  referenceMap: Map<string, string>;
  rules: Map<string, CategoryRuleRow>;
  neighbours?: Promise<Neighbour[]>;
}

/** Per-user rules and neighbours; dropped whenever the user's categories or rules change. */
const contexts = new Map<string, Promise<UserContext>>();
const textVectors = new Map<string, Float32Array>();

function invalidate(userId: string) {
  contexts.delete(userId);
}

async function embedCached(text: string): Promise<Float32Array> {
  let vector = textVectors.get(text);
  if (!vector) {
    vector = await embed(embeddingText(text));
    textVectors.set(text, vector);
  }
  return vector;
}

/** New users start with the reference categories mapped one to one, plus a catch-all. */
async function ensureSeeded(userId: string) {
  await db.transaction(async (tx) => {
    if (!(await claimCategorySeeding(userId, tx))) return;
    for (const name of referenceCategories()) {
      const category = await insertCategory(userId, name, tx);
      await assignReferenceCategories(userId, category.id, [name], tx);
    }
    await insertCategory(userId, FALLBACK_CATEGORY, tx);
  });
}

async function loadContext(userId: string): Promise<UserContext> {
  await ensureSeeded(userId);
  const [categories, map, rules] = await Promise.all([
    findCategoriesByUserId(userId),
    findReferenceMap(userId),
    findRulesByUserId(userId),
  ]);
  return {
    categories,
    referenceMap: new Map(map.map((row) => [row.referenceCategory, row.categoryId])),
    rules: new Map(rules.map((rule) => [rule.pattern, rule])),
  };
}

function context(userId: string): Promise<UserContext> {
  let pending = contexts.get(userId);
  if (!pending) {
    pending = loadContext(userId);
    pending.catch(() => contexts.delete(userId));
    contexts.set(userId, pending);
  }
  return pending;
}

/** Category names, the user's confirmed descriptions and the reference examples of mapped categories. */
async function buildNeighbours(ctx: UserContext): Promise<Neighbour[]> {
  const neighbours: Neighbour[] = [];
  for (const category of ctx.categories) neighbours.push({ vector: await embedCached(category.name), categoryId: category.id });
  const reference = loadReferenceVectors();
  for (const [referenceCategory, categoryId] of ctx.referenceMap)
    neighbours.push({ vector: await embedCached(referenceCategory), categoryId });
  reference.entries.forEach((entry, i) => {
    const categoryId = ctx.referenceMap.get(entry.category);
    if (categoryId) neighbours.push({ vector: reference.vectors[i], categoryId });
  });
  const version = modelVersion();
  for (const rule of ctx.rules.values()) {
    let vector = rule.embedding;
    if (!vector || rule.modelVersion !== version) {
      vector = Array.from(await embed(embeddingText(rule.pattern)));
      await updateRuleEmbedding(rule.id, vector, version);
    }
    neighbours.push({ vector, categoryId: rule.categoryId });
  }
  return neighbours;
}

export async function suggestCategory(userId: string, description: string | null | undefined): Promise<CategorySuggestion | null> {
  const pattern = description ? rulePattern(description) : '';
  if (!pattern) return null;
  const ctx = await context(userId);
  const rule = ctx.rules.get(pattern);
  if (rule) return { categoryId: rule.categoryId, source: 'rule', margin: null, confident: true };
  if (!config.categorizeModel) return null;
  if (!ctx.neighbours) {
    ctx.neighbours = buildNeighbours(ctx);
    ctx.neighbours.catch(() => (ctx.neighbours = undefined));
  }
  const [neighbours, vector] = await Promise.all([ctx.neighbours, embed(embeddingText(description!))]);
  const nearest = nearestCategory(vector, neighbours);
  if (!nearest) return null;
  return { ...nearest, source: 'model', confident: nearest.margin >= config.categorizeMinMargin };
}

/** Category fields for a new purchase; never fails the purchase itself. */
export async function categorizeNewPurchase(userId: string, description: string | null | undefined) {
  const none = { categoryId: null, categorySource: null, categoryMargin: null };
  try {
    const suggestion = await suggestCategory(userId, description);
    if (!suggestion?.confident) return none;
    return { categoryId: suggestion.categoryId, categorySource: suggestion.source, categoryMargin: suggestion.margin };
  } catch (error) {
    logger.warn({ err: error }, 'Expense categorisation failed');
    return none;
  }
}

export async function listCategories(userId: string) {
  const ctx = await context(userId);
  return ctx.categories.map((category) => ({
    id: category.id,
    name: category.name,
    referenceCategories: [...ctx.referenceMap].filter(([, id]) => id === category.id).map(([name]) => name),
  }));
}

export function listReferenceCategories(): string[] {
  return referenceCategories();
}

function checkReferenceCategories(names: string[] | undefined) {
  if (!names) return;
  const known = new Set(referenceCategories());
  const unknown = names.find((name) => !known.has(name));
  if (unknown) throw new CategoryError(`Unknown reference category: ${unknown}`);
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === '23505' || e?.cause?.code === '23505';
}

export async function createCategory(userId: string, data: { name: string; referenceCategories?: string[] }) {
  checkReferenceCategories(data.referenceCategories);
  await ensureSeeded(userId);
  try {
    const category = await db.transaction(async (tx) => {
      const row = await insertCategory(userId, data.name, tx);
      if (data.referenceCategories) await assignReferenceCategories(userId, row.id, data.referenceCategories, tx);
      return row;
    });
    invalidate(userId);
    return (await listCategories(userId)).find((c) => c.id === category.id)!;
  } catch (error) {
    if (isUniqueViolation(error)) throw new CategoryError('Category already exists');
    throw error;
  }
}

export async function updateCategory(userId: string, id: string, data: { name?: string; referenceCategories?: string[] }) {
  checkReferenceCategories(data.referenceCategories);
  if (!(await findCategory(userId, id))) return null;
  try {
    await db.transaction(async (tx) => {
      if (data.name !== undefined) await renameCategory(userId, id, data.name, tx);
      if (data.referenceCategories) await assignReferenceCategories(userId, id, data.referenceCategories, tx);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new CategoryError('Category already exists');
    throw error;
  } finally {
    invalidate(userId);
  }
  return (await listCategories(userId)).find((c) => c.id === id) ?? null;
}

/** Purchases of the category become uncategorised; its rules and reference mapping go with it. */
export async function deleteCategory(userId: string, id: string): Promise<boolean> {
  const deleted = await removeCategory(userId, id);
  invalidate(userId);
  return deleted;
}

/**
 * The user's choice for a purchase. It becomes a rule, and every other purchase with the same
 * description the user has not set by hand follows it.
 */
export async function setPurchaseCategory(userId: string, cardId: string, purchaseId: string, categoryId: string | null) {
  const purchase = await findUserPurchase(userId, cardId, purchaseId);
  if (!purchase) return null;
  if (categoryId && !(await findCategory(userId, categoryId))) throw new CategoryError('Category not found');
  await setPurchaseCategories([purchase.id], { categoryId, categorySource: 'user', categoryMargin: null });
  const pattern = purchase.description ? rulePattern(purchase.description) : '';
  if (categoryId && pattern) {
    let embedding: number[] | null = null;
    if (config.categorizeModel) {
      try {
        embedding = Array.from(await embed(embeddingText(pattern)));
      } catch (error) {
        logger.warn({ err: error }, 'Rule embedding failed');
      }
    }
    await upsertRule(userId, { pattern, categoryId, embedding, modelVersion: embedding ? modelVersion() : null });
    const same = (await findPurchasesNotSetByUser(userId)).filter(
      (other) => other.description && rulePattern(other.description) === pattern
    );
    await setPurchaseCategories(same.map((other) => other.id), { categoryId, categorySource: 'rule', categoryMargin: null });
    invalidate(userId);
  }
  return { ...purchase, categoryId, categorySource: 'user' };
}

export async function listUncategorizedPurchases(userId: string) {
  return findUncategorizedPurchases(userId);
}

/** Categorises earlier purchases that have no category yet, where a rule or a confident model allows. */
export async function backfillCategories(userId: string) {
  const pending = (await findPurchasesNotSetByUser(userId)).filter((purchase) => !purchase.categoryId);
  let categorized = 0;
  for (const purchase of pending) {
    const suggestion = await suggestCategory(userId, purchase.description);
    if (!suggestion?.confident) continue;
    await setPurchaseCategories([purchase.id], {
      categoryId: suggestion.categoryId,
      categorySource: suggestion.source,
      categoryMargin: suggestion.margin,
    });
    categorized++;
  }
  return { categorized, remaining: pending.length - categorized };
}
