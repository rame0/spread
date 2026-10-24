import { getPurchaseDueDate, resolveCardSettings } from '../domain/card-grace';
import {
  buildInstallmentSchedule,
  type InstallmentInterval,
} from '../domain/installment-schedule';
import { findCardById } from '../repositories/cardRepository';
import { updateCardSettings } from '../repositories/cardRepository';
import { createPurchase } from '../repositories/purchaseRepository';
import { findPurchasesByCardId } from '../repositories/purchaseRepository';
import { findBucketsByCardId, insertInstallmentBuckets } from '../repositories/graceBucketRepository';
import { upsertBucket } from '../repositories/graceBucketRepository';
import { categorizeNewPurchase } from './categoryService';
import { rebalanceCard } from './depositService';

export interface InstallmentPlan {
  installmentCount: number;
  installmentInterval: InstallmentInterval;
  firstPaymentDate: string;
  installmentFee?: number;
}

/** Plan is required on installment cards and forbidden on credit cards. */
export class InstallmentPlanError extends Error {}

export async function addPurchase(
  cardId: string,
  data: { purchaseDate: string; amount: number; description?: string; plan?: InstallmentPlan },
  userId?: string,
  executor?: any
) {
  const dbOrTx = executor;
  const card = await findCardById(cardId, dbOrTx);
  if (!card) throw new Error('Card not found');
  if (userId != null && card.userId !== userId) throw new Error('Card not found');
  const { plan, ...fields } = data;
  const purchaseData = { ...fields, ...(await categorizeNewPurchase(card.userId, data.description)) };

  if (card.kind !== 'installment') {
    if (plan) throw new InstallmentPlanError('Installment plan is only allowed on installment cards');
    await addDebtToBucket(cardId, data.purchaseDate, data.amount, dbOrTx, card);
    const purchase = await createPurchase(cardId, purchaseData, dbOrTx);
    // Later payments may already be spent on later periods; batch callers rebalance once at the end.
    if (executor === undefined) await rebalanceCard(cardId);
    return purchase;
  }

  if (!plan) throw new InstallmentPlanError('Installment plan is required');
  if (plan.firstPaymentDate < data.purchaseDate) {
    throw new InstallmentPlanError('First payment must not be earlier than the purchase');
  }
  const fee = plan.installmentFee ?? 0;
  const schedule = buildInstallmentSchedule({
    amount: data.amount,
    fee,
    count: plan.installmentCount,
    interval: plan.installmentInterval,
    firstPaymentDate: plan.firstPaymentDate,
  });
  const purchase = await createPurchase(cardId, { ...purchaseData, ...plan, installmentFee: fee }, dbOrTx);
  await insertInstallmentBuckets(cardId, purchase.id, schedule, dbOrTx);
  return purchase;
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
  if (card.kind === 'installment') {
    // Debt without a plan (e.g. found by reconciliation) is due immediately.
    const [year, month] = dateString.split('-').map(Number);
    await upsertBucket(cardId, year, month, dateString, dateString, amount, dbOrTx);
    return;
  }
  const { periodStartDate, period, dueDate, anchorDay } = await resolvePurchaseBucket(card, dateString, dbOrTx);
  if (anchorDay !== null) await updateCardSettings(cardId, { reportDay: anchorDay }, dbOrTx);
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
  const card = await findCardById(cardId);
  if (!card || (userId != null && card.userId !== userId)) return [];
  const purchases = await findPurchasesByCardId(cardId, from, to);
  if (card.kind !== 'installment') return purchases;

  const buckets = await findBucketsByCardId(cardId);
  const today = new Date().toISOString().slice(0, 10);
  return purchases.map((purchase) => {
    const own = buckets
      .filter((bucket) => bucket.purchaseId === purchase.id)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const open = own.filter((bucket) => bucket.principalRemaining > 0);
    return {
      ...purchase,
      installments: {
        count: own.length,
        paid: own.length - open.length,
        nextDueDate: open[0]?.dueDate ?? null,
        nextDueAmount: open[0] ? roundMoney(open[0].principalRemaining) : 0,
        remaining: roundMoney(open.reduce((sum, bucket) => sum + bucket.principalRemaining, 0)),
        overdue: open.some((bucket) => bucket.dueDate < today),
      },
    };
  });
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

type CardRow = NonNullable<Awaited<ReturnType<typeof findCardById>>>;

/**
 * Grace bucket a credit card purchase on this date falls into.
 * `anchorDay` is set when the purchase starts a new Ozon anchor and the card's report day must move to it.
 */
async function resolvePurchaseBucket(card: CardRow, dateString: string, executor?: any) {
  const date = new Date(dateString);
  let settings = resolveCardSettings({
    graceModel: card.graceModel as 'legacy_months' | 'statement_periods' | 'ozon_anchor',
    reportDay: card.reportDay,
    gracePeriods: card.gracePeriods,
    graceDueDay: card.graceDueDay,
    graceStatementPeriods: card.graceStatementPeriods,
    paymentDueOffsetDays: card.paymentDueOffsetDays,
  });
  const existingBuckets = await findBucketsByCardId(card.id, executor);
  const existingActiveStartDates = existingBuckets
    .filter((b) => b.principalRemaining > 0)
    .map((b) => new Date(b.periodStartDate));

  const startsAnchor = settings.graceModel === 'ozon_anchor' && existingActiveStartDates.length === 0;
  if (startsAnchor) settings = resolveCardSettings({ ...settings, reportDay: date.getDate() });

  return { ...getPurchaseDueDate(date, settings, existingActiveStartDates), anchorDay: startsAnchor ? date.getDate() : null };
}

/** Due date a credit card purchase on this date would get, without saving anything; null on installment cards. */
export async function previewPurchaseDueDate(cardId: string, dateString: string, userId: string): Promise<string | null> {
  const card = await findCardById(cardId);
  if (!card || card.userId !== userId) throw new Error('Card not found');
  if (card.kind === 'installment') return null;
  const { dueDate } = await resolvePurchaseBucket(card, dateString);
  return dueDate.toISOString().slice(0, 10);
}
