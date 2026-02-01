import { getStatementPeriodStart } from '../domain/statement-period';
import { getGraceDueDate } from '../domain/grace-due';
import { findCardById } from '../repositories/cardRepository';
import { createPurchase } from '../repositories/purchaseRepository';
import { findPurchasesByCardId } from '../repositories/purchaseRepository';
import { upsertBucket } from '../repositories/graceBucketRepository';

export async function addPurchase(
  cardId: string,
  data: { purchaseDate: string; amount: number; description?: string }
) {
  const card = await findCardById(cardId);
  if (!card) throw new Error('Card not found');
  const date = new Date(data.purchaseDate);
  const period = getStatementPeriodStart(date, card.reportDay);
  const dueDate = getGraceDueDate(
    { year: period.year, month: period.month },
    card.gracePeriods,
    card.graceDueDay
  );
  const dueDateStr = dueDate.toISOString().slice(0, 10);
  await upsertBucket(
    cardId,
    period.year,
    period.month,
    dueDateStr,
    data.amount
  );
  return createPurchase(cardId, data);
}

export async function getPurchases(cardId: string, from?: string, to?: string) {
  return findPurchasesByCardId(cardId, from, to);
}
