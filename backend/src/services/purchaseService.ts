import { getStatementPeriodStart } from '../domain/statement-period';
import { getBucketDueDate, resolveCardSettings } from '../domain/card-grace';
import { findCardById } from '../repositories/cardRepository';
import { createPurchase } from '../repositories/purchaseRepository';
import { findPurchasesByCardId } from '../repositories/purchaseRepository';
import { upsertBucket } from '../repositories/graceBucketRepository';

export async function addPurchase(
  cardId: string,
  data: { purchaseDate: string; amount: number; description?: string },
  userId?: string,
  executor?: any
) {
  const dbOrTx = executor;
  const card = await findCardById(cardId, dbOrTx);
  if (!card) throw new Error('Card not found');
  if (userId != null && card.userId !== userId) throw new Error('Card not found');
  const date = new Date(data.purchaseDate);
  const period = getStatementPeriodStart(date, card.reportDay);
  const settings = resolveCardSettings({
    graceModel: card.graceModel as 'legacy_months' | 'statement_periods',
    reportDay: card.reportDay,
    gracePeriods: card.gracePeriods,
    graceDueDay: card.graceDueDay,
    graceStatementPeriods: card.graceStatementPeriods,
    paymentDueOffsetDays: card.paymentDueOffsetDays,
  });
  const dueDate = getBucketDueDate({ year: period.year, month: period.month }, settings);
  const dueDateStr = dueDate.toISOString().slice(0, 10);
  await upsertBucket(
    cardId,
    period.year,
    period.month,
    dueDateStr,
    data.amount,
    dbOrTx
  );
  return createPurchase(cardId, data, dbOrTx);
}

export async function getPurchases(
  cardId: string,
  from?: string,
  to?: string,
  userId?: string
) {
  if (userId != null) {
    const card = await findCardById(cardId);
    if (!card || card.userId !== userId) return [];
  }
  return findPurchasesByCardId(cardId, from, to);
}
