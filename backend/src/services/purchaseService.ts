import {
  getBucketDueDate,
  getBucketPeriodStart,
  getMonthlyPeriodStart,
  resolveCardSettings,
} from '../domain/card-grace';
import { findCardById } from '../repositories/cardRepository';
import { updateCardSettings } from '../repositories/cardRepository';
import { createPurchase } from '../repositories/purchaseRepository';
import { findPurchasesByCardId } from '../repositories/purchaseRepository';
import { findBucketsByCardId } from '../repositories/graceBucketRepository';
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
  await addDebtToBucket(cardId, data.purchaseDate, data.amount, dbOrTx, card);
  return createPurchase(cardId, data, dbOrTx);
}

/** Adds debt to the grace bucket for a date without creating a purchase event. */
export async function addDebtToBucket(
  cardId: string,
  dateString: string,
  amount: number,
  executor?: any,
  knownCard?: Awaited<ReturnType<typeof findCardById>>
) {
  const dbOrTx = executor;
  const card = knownCard ?? await findCardById(cardId, dbOrTx);
  if (!card) throw new Error('Card not found');
  const date = new Date(dateString);
  let settings = resolveCardSettings({
    graceModel: card.graceModel as 'legacy_months' | 'statement_periods' | 'ozon_anchor',
    reportDay: card.reportDay,
    gracePeriods: card.gracePeriods,
    graceDueDay: card.graceDueDay,
    graceStatementPeriods: card.graceStatementPeriods,
    paymentDueOffsetDays: card.paymentDueOffsetDays,
  });
  const existingBuckets = await findBucketsByCardId(cardId, dbOrTx);
  const existingActiveStartDates = existingBuckets
    .filter((b) => b.principalRemaining > 0)
    .map((b) => new Date(b.periodStartDate));

  if (settings.graceModel === 'ozon_anchor' && existingActiveStartDates.length === 0) {
    await updateCardSettings(cardId, { reportDay: date.getDate() }, dbOrTx);
    settings = resolveCardSettings({ ...settings, reportDay: date.getDate() });
  }

  const periodStartDate = getBucketPeriodStart(date, settings, existingActiveStartDates);
  const period =
    settings.graceModel === 'ozon_anchor'
      ? {
          year: periodStartDate.getFullYear(),
          month: periodStartDate.getMonth() + 1,
        }
      : getMonthlyPeriodStart(date, settings.reportDay);
  const dueDate = getBucketDueDate(period, settings, periodStartDate);
  const periodStartDateStr = periodStartDate.toISOString().slice(0, 10);
  const dueDateStr = dueDate.toISOString().slice(0, 10);
  await upsertBucket(
    cardId,
    period.year,
    period.month,
    periodStartDateStr,
    dueDateStr,
    amount,
    dbOrTx
  );
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
