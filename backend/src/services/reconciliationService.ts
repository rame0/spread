import { eq, max } from 'drizzle-orm';
import { db, cards, deposits, purchases } from '../db';
import { findCardById } from '../repositories/cardRepository';
import { pastDueDebt } from '../domain/deposit-allocation';
import { findBucketsByCardId, updateBucketRemaining } from '../repositories/graceBucketRepository';
import {
  createReconciliation,
  createReconciliationAllocations,
  findLatestReconciliationDate,
  findReconciliationsByCardId,
} from '../repositories/reconciliationRepository';
import { addDebtToBucket } from './purchaseService';

const cents = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);

export class ReconciliationDateError extends Error {
  constructor(
    /** Lower bound caused by the latest existing card event, if any. */
    public readonly firstAllowedDate: string | null,
    /** Upper bound of the allowed interval. */
    public readonly lastAllowedDate: string
  ) {
    super('Reconciliation date must not be earlier than the latest card event or later than today');
  }
}

export async function latestEventDate(cardId: string, executor: any = db): Promise<string | null> {
  const [p, d, r] = await Promise.all([
    executor.select({ date: max(purchases.purchaseDate) }).from(purchases).where(eq(purchases.cardId, cardId)),
    executor.select({ date: max(deposits.depositDate) }).from(deposits).where(eq(deposits.cardId, cardId)),
    findLatestReconciliationDate(cardId, executor),
  ]);
  return [p[0]?.date, d[0]?.date, r].filter((v): v is string => Boolean(v)).sort().at(-1) ?? null;
}

export type ReconciliationInput = {
  reconciliationDate: string;
  actualDebt: number;
  /** The bank shows no overdue: past-due debt has moved to the current period. */
  noOverdue?: boolean;
};

export async function reconcileBalance(
  cardId: string,
  data: ReconciliationInput,
  userId: string
) {
  return db.transaction(async (tx) => {
    // Serializes concurrent confirmations for the same card.
    const [card] = await tx.select().from(cards).where(eq(cards.id, cardId)).for('update').limit(1);
    if (!card || card.userId !== userId) throw new Error('Card not found');
    return reconcileBalanceInTransaction(cardId, data, userId, tx, card);
  });
}

/** Used by import so its event stream remains one atomic transaction. Card must be locked by caller. */
export async function reconcileBalanceInTransaction(
  cardId: string,
  data: ReconciliationInput,
  userId: string,
  tx: any,
  lockedCard?: typeof cards.$inferSelect
) {
    const card = lockedCard ?? await findCardById(cardId, tx);
    if (!card || card.userId !== userId) throw new Error('Card not found');
    const minimumDate = await latestEventDate(cardId, tx);
    if (data.reconciliationDate > today() || (minimumDate && data.reconciliationDate < minimumDate)) {
      throw new ReconciliationDateError(minimumDate, today());
    }

    const rows = await findBucketsByCardId(cardId, tx);
    const calculatedDebtBefore = cents(rows.reduce((sum, row) => sum + Math.max(0, row.principalRemaining), 0));
    const actualDebt = cents(data.actualDebt);
    const difference = cents(actualDebt - calculatedDebtBefore);
    const allocations: { graceBucketId: string; amount: number }[] = [];

    if (difference > 0) {
      await addDebt(cardId, data.reconciliationDate, difference, tx, card, allocations);
    } else if (difference < 0) {
      let toRemove = cents(-difference);
      const sorted = [...rows]
        .filter((r) => r.principalRemaining > 0 && (r.status === 'active' || r.status === 'overdue'))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      for (const bucket of sorted) {
        if (toRemove <= 0) break;
        const amount = cents(Math.min(toRemove, bucket.principalRemaining));
        const remaining = cents(bucket.principalRemaining - amount);
        await updateBucketRemaining(bucket.id, remaining, remaining === 0 ? 'closed' : bucket.status as any, tx);
        allocations.push({ graceBucketId: bucket.id, amount: -amount });
        toRemove = cents(toRemove - amount);
      }
    }
    const overdueMoved = data.noOverdue && card.kind !== 'installment' ? await movePastDueDebt(cardId, data.reconciliationDate, tx, card, allocations) : 0;
    const reconciliation = await createReconciliation(cardId, {
      reconciliationDate: data.reconciliationDate, actualDebt, calculatedDebtBefore, difference, overdueMoved,
    }, tx);
    await createReconciliationAllocations(reconciliation.id, allocations, tx);
    return reconciliation;
}

/**
 * Closes the periods past due on `date` and adds their debt to the period of `date`. Recorded as
 * a repayment of the old periods and new debt of the current one, so rebalancing keeps the move.
 */
async function movePastDueDebt(
  cardId: string,
  date: string,
  tx: any,
  card: typeof cards.$inferSelect,
  allocations: { graceBucketId: string; amount: number }[]
): Promise<number> {
  const moves = pastDueDebt(await findBucketsByCardId(cardId, tx), date);
  const total = cents(moves.reduce((sum, move) => sum + move.amount, 0));
  if (total <= 0) return 0;
  for (const move of moves) {
    await updateBucketRemaining(move.graceBucketId, 0, 'closed', tx);
    allocations.push({ graceBucketId: move.graceBucketId, amount: -move.amount });
  }
  await addDebt(cardId, date, total, tx, card, allocations);
  return total;
}

/** Adds debt to the period of `date` and records which bucket got it. */
async function addDebt(
  cardId: string,
  date: string,
  amount: number,
  tx: any,
  card: typeof cards.$inferSelect,
  allocations: { graceBucketId: string; amount: number }[]
) {
  const before = await findBucketsByCardId(cardId, tx);
  await addDebtToBucket(cardId, date, amount, tx, card);
  const after = await findBucketsByCardId(cardId, tx);
  const changed = after.find((a) => {
    const b = before.find((x) => x.id === a.id);
    return !b || cents(a.principalRemaining - b.principalRemaining) === amount;
  });
  if (changed) allocations.push({ graceBucketId: changed.id, amount });
}

export async function getReconciliations(cardId: string, userId: string) {
  const card = await findCardById(cardId);
  if (!card || card.userId !== userId) return null;
  return findReconciliationsByCardId(cardId);
}
