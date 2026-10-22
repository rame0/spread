import { resolveCardSettings } from '../domain/card-grace';
import { buildLateSchedule, defaultMinimumTerms, statementCalendar, type LatePaymentRow } from '../domain/minimum-payment';
import type { CardSettings } from '../domain/types';
import type { CardRow } from '../repositories/cardRepository';
import { findDepositsByCardId } from '../repositories/depositRepository';
import type { GraceBucketRow } from '../repositories/graceBucketRepository';
import { findPurchasesByCardId } from '../repositories/purchaseRepository';

export function cardSettingsOf(card: CardRow): CardSettings {
  return resolveCardSettings({
    graceModel: card.graceModel as CardSettings['graceModel'],
    reportDay: card.reportDay,
    gracePeriods: card.gracePeriods,
    graceDueDay: card.graceDueDay,
    graceStatementPeriods: card.graceStatementPeriods,
    paymentDueOffsetDays: card.paymentDueOffsetDays,
  });
}

/** Whether the card is paid with minimum payments and each bucket on its due date. */
export function paysLate(card: CardRow): boolean {
  return card.kind === 'credit' && card.payoffStrategy === 'latest';
}

/** Payments of a card that pays late, from today until its current debt is repaid. */
export async function getLateSchedule(card: CardRow, rows: GraceBucketRow[], today: string): Promise<LatePaymentRow[]> {
  const open = rows.filter((row) => row.principalRemaining > 0).sort((left, right) => left.periodStartDate.localeCompare(right.periodStartDate));
  if (open.length === 0) return [];
  const settings = cardSettingsOf(card);
  const calendar = statementCalendar(settings, open[0].periodStartDate);
  const lastClose = calendar.closeOnOrBefore(today);
  const after = (date: string) => date > lastClose && date <= today;
  const [purchases, deposits] = await Promise.all([findPurchasesByCardId(card.id), findDepositsByCardId(card.id)]);
  const defaults = defaultMinimumTerms(settings.graceModel);
  return buildLateSchedule({
    today,
    terms: { percent: card.minPaymentPercent ?? defaults.percent, minimum: card.minPaymentMinimum ?? defaults.minimum },
    calendar,
    buckets: open.map((row) => ({ id: row.id, dueDate: row.dueDate, remaining: row.principalRemaining })),
    purchasedSinceStatement: purchases.filter((row) => after(row.purchaseDate)).reduce((sum, row) => sum + row.amount, 0),
    paidSinceStatement: deposits.filter((row) => after(row.depositDate)).reduce((sum, row) => sum + row.amount, 0),
  });
}
