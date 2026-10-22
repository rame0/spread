import { buildPlanForCard } from '../domain/plan';
import { findCardById, findCardsByUserId } from '../repositories/cardRepository';
import { findBucketsByCardId } from '../repositories/graceBucketRepository';
import { findPurchasesByCardId } from '../repositories/purchaseRepository';
import { findEventsByMortgageId, findMortgagesByUserId } from '../repositories/mortgageRepository';
import { simulateMortgage } from '../domain/mortgage-schedule';
import { toDomainEvent, toTerms } from './mortgageService';
import { buildCardSpending, buildDebtLoad, type CardDebtKind, type CardSpendingMonth, type DebtLoadMonth } from '../domain/overview-charts';
import type { GraceBucketRow } from '../repositories/graceBucketRepository';
import type { GraceBucket } from '../domain/types';
import type { LatePaymentRow } from '../domain/minimum-payment';
import type { CardRow } from '../repositories/cardRepository';
import { getLateSchedule, paysLate } from './cardScheduleService';

export function rowToBucket(row: GraceBucketRow, asOf: Date): GraceBucket {
  const dueDate = new Date(row.dueDate);
  let status = row.status as GraceBucket['status'];
  if (status === 'active' && row.principalRemaining > 0 && dueDate.toISOString().slice(0, 10) < asOf.toISOString().slice(0, 10)) {
    status = 'overdue';
  }
  if (row.principalRemaining <= 0) status = 'closed';
  return {
    id: row.id,
    cardId: row.cardId,
    statementPeriodStart: { year: row.periodYear, month: row.periodMonth },
    periodStartDate: new Date(row.periodStartDate),
    principalTotal: row.principalTotal,
    principalRemaining: row.principalRemaining,
    dueDate,
    status,
  };
}

export interface DashboardResult {
  /** Сумма к внесению в текущем месяце, чтобы не выйти из грейса (главный показатель) */
  currentMonthAmount: number;
  nextDueDate: string | null;
  totalRemaining: number;
  /** Минимум до ближайшего дедлайна (для контекста) */
  recommendedDeposit: number;
  buckets: Array<{
    id: string;
    statementPeriodStart: { year: number; month: number };
    principalRemaining: number;
    dueDate: string;
    status: string;
    /** Present on installment cards. */
    installment?: { number: number; count: number; description: string | null };
  }>;
}

export type DebtKind = 'credit' | 'installment' | 'mortgage';

export interface MainDashboardResult {
  dueThisMonth: number;
  overdueAmount: number;
  totalRemaining: number;
  plannedThisMonth: number;
  cards: Array<{
    id: string;
    name: string;
    kind: DebtKind;
    totalRemaining: number;
    overdueAmount: number;
    nextDueDate: string | null;
    nextDueAmount: number;
  }>;
  /** Overdue payments and those due in the next PAYMENTS_HORIZON_DAYS days. */
  payments: Array<{
    /** Card or mortgage id, depending on `kind`. */
    cardId: string;
    cardName: string;
    kind: DebtKind;
    dueDate: string;
    amount: number;
    status: 'overdue' | 'upcoming';
    /** How many card buckets are merged into this payment. */
    parts: number;
    /** Credit card: the statement period of the first merged bucket. */
    period?: { year: number; month: number };
    /** Installment card: the first merged purchase payment. */
    installment?: { number: number; count: number; description: string | null };
    /** Mortgage: payment number and its interest part. */
    mortgage?: { number: number; interest: number };
    /** Card paid late: the minimum payment and the buckets closed by this payment. */
    minimum?: number;
    closing?: number;
  }>;
}

const PAYMENTS_HORIZON_DAYS = 30;

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Aggregated dashboard that only reads cards belonging to the authenticated user. */
export async function getMainDashboard(userId: string, asOfStr?: string): Promise<MainDashboardResult> {
  const asOf = asOfStr ? new Date(asOfStr) : new Date();
  const today = dateOnly(asOf);
  const monthEnd = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + 1, 0));
  const monthEndDate = dateOnly(monthEnd);
  const horizonDate = dateOnly(new Date(asOf.getTime() + PAYMENTS_HORIZON_DAYS * 86_400_000));
  const cards = await findCardsByUserId(userId);

  const cardResults = await Promise.all(cards.map(async (card) => {
    const rows = await findBucketsByCardId(card.id);
    const buckets = rows.map((row) => rowToBucket(row, asOf));
    const active = buckets.filter((bucket) => bucket.principalRemaining > 0 && (bucket.status === 'active' || bucket.status === 'overdue'));
    const totalRemaining = roundMoney(active.reduce((sum, bucket) => sum + bucket.principalRemaining, 0));
    const overdue = active.filter((bucket) => dateOnly(bucket.dueDate) < today);
    const overdueAmount = roundMoney(overdue.reduce((sum, bucket) => sum + bucket.principalRemaining, 0));
    const upcomingThisMonth = active.filter((bucket) => {
      const due = dateOnly(bucket.dueDate);
      return due >= today && due <= monthEndDate;
    });
    const upcoming = active.filter((bucket) => {
      const due = dateOnly(bucket.dueDate);
      return due >= today && due <= horizonDate;
    });
    const late = paysLate(card) ? await getLateSchedule(card, rows, today) : null;
    const plan = buildPlanForCard(card.kind, buckets, asOf);
    const plannedThisMonth = late
      ? roundMoney(late.filter((row) => row.date <= monthEndDate).reduce((sum, row) => sum + row.amount, 0))
      : plan.find((row) => row.year === asOf.getFullYear() && row.month === asOf.getMonth() + 1)?.amount ?? 0;
    const dueThisMonth = late
      ? late.filter((row) => !row.overdue && row.date <= monthEndDate).reduce((sum, row) => sum + row.amount, 0)
      : upcomingThisMonth.reduce((sum, bucket) => sum + bucket.principalRemaining, 0);
    const nextDue = [...active].sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime())[0];
    const nextLate = late?.find((row) => !row.overdue);
    const installmentInfo = card.kind === 'installment' ? await getInstallmentInfo(card.id, rows) : null;

    return {
      card: {
        id: card.id,
        name: card.name,
        kind: card.kind as DebtKind,
        totalRemaining,
        overdueAmount,
        nextDueDate: late ? nextLate?.date ?? null : nextDue ? dateOnly(nextDue.dueDate) : null,
        nextDueAmount: late ? nextLate?.amount ?? 0 : nextDue?.principalRemaining ?? 0,
      },
      overdue,
      upcoming,
      dueThisMonth,
      plannedThisMonth,
      installmentInfo,
      late,
      buckets,
    };
  }));

  const paymentsByCardAndDate = new Map<string, MainDashboardResult['payments'][number]>();
  for (const { card, overdue, upcoming, installmentInfo, late, buckets } of cardResults) {
    if (late) {
      for (const row of late.filter((item) => item.date <= horizonDate)) {
        paymentsByCardAndDate.set(`${card.id}:${row.date}`, latePayment(card, row, buckets));
      }
      continue;
    }
    const sortedBuckets = [...overdue, ...upcoming].sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime());
    for (const bucket of sortedBuckets) {
      const dueDate = dateOnly(bucket.dueDate);
      const key = `${card.id}:${dueDate}`;
      const existing = paymentsByCardAndDate.get(key);
      if (existing) {
        existing.amount = roundMoney(existing.amount + bucket.principalRemaining);
        existing.parts += 1;
      } else {
        const installment = installmentInfo?.get(bucket.id);
        paymentsByCardAndDate.set(key, {
          cardId: card.id,
          cardName: card.name,
          kind: card.kind as DebtKind,
          dueDate,
          amount: bucket.principalRemaining,
          status: dueDate < today ? 'overdue' : 'upcoming',
          parts: 1,
          ...(installment ? { installment } : card.kind === 'credit' ? { period: bucket.statementPeriodStart } : {}),
        });
      }
    }
  }
  const mortgageResults = await getMortgageSummaries(userId, today, monthEndDate, horizonDate);
  for (const mortgage of mortgageResults) {
    for (const row of mortgage.payments) paymentsByCardAndDate.set(`${mortgage.card.id}:${row.dueDate}`, row);
  }
  const payments = Array.from(paymentsByCardAndDate.values())
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.cardName.localeCompare(right.cardName));

  const sortedCards = [...cardResults.map(({ card }) => card), ...mortgageResults.map(({ card }) => card)].sort((left, right) => {
    if (Boolean(right.overdueAmount) !== Boolean(left.overdueAmount)) return right.overdueAmount - left.overdueAmount;
    if (!left.nextDueDate) return 1;
    if (!right.nextDueDate) return -1;
    return left.nextDueDate.localeCompare(right.nextDueDate) || left.name.localeCompare(right.name);
  });

  return {
    dueThisMonth: roundMoney(
      cardResults.reduce((sum, item) => sum + item.dueThisMonth, 0) +
        mortgageResults.reduce((sum, item) => sum + item.dueThisMonth, 0)
    ),
    overdueAmount: roundMoney(sortedCards.reduce((sum, item) => sum + item.overdueAmount, 0)),
    totalRemaining: roundMoney(sortedCards.reduce((sum, item) => sum + item.totalRemaining, 0)),
    plannedThisMonth: roundMoney(
      cardResults.reduce((sum, item) => sum + item.plannedThisMonth, 0) +
        mortgageResults.reduce((sum, item) => sum + item.dueThisMonth + item.card.overdueAmount, 0)
    ),
    cards: sortedCards,
    payments,
  };
}

/** A payment of a card paid late; the period is that of the first bucket it closes. */
function latePayment(card: Pick<CardRow, 'id' | 'name'>, row: LatePaymentRow, buckets: GraceBucket[]): MainDashboardResult['payments'][number] {
  const closed = row.closing > 0 ? buckets.filter((bucket) => row.bucketIds.includes(bucket.id) && dateOnly(bucket.dueDate) <= row.date) : [];
  return {
    cardId: card.id,
    cardName: card.name,
    kind: 'credit',
    dueDate: row.date,
    amount: row.amount,
    status: row.overdue ? 'overdue' : 'upcoming',
    parts: Math.max(1, closed.length),
    ...(closed[0] ? { period: closed[0].statementPeriodStart } : {}),
    minimum: row.minimum,
    closing: row.closing,
  };
}

export interface OverviewChartsResult {
  debtLoad: DebtLoadMonth[];
  cardSpending: { cards: Array<{ id: string; name: string; kind: string }>; months: CardSpendingMonth[] };
}

/** Debt payments for the months ahead and card purchases for the months behind. */
export async function getOverviewCharts(userId: string, months: number, asOfStr?: string): Promise<OverviewChartsResult> {
  const asOf = asOfStr ? new Date(asOfStr) : new Date();
  const today = dateOnly(asOf);
  const cards = await findCardsByUserId(userId);
  const perCard = await Promise.all(cards.map(async (card) => {
    const [rows, purchases] = await Promise.all([findBucketsByCardId(card.id), findPurchasesByCardId(card.id)]);
    const buckets = rows.map((row) => rowToBucket(row, asOf)).filter((bucket) => bucket.principalRemaining > 0 && bucket.status !== 'closed');
    const late = paysLate(card) ? await getLateSchedule(card, rows, today) : null;
    return {
      card,
      payments: late
        ? late.map((row) => ({ kind: 'credit' as const, dueDate: row.date, amount: row.amount }))
        : buckets.map((bucket) => ({ kind: card.kind as CardDebtKind, dueDate: dateOnly(bucket.dueDate), amount: bucket.principalRemaining })),
      purchases: purchases.map((purchase) => ({ cardId: card.id, date: purchase.purchaseDate, amount: purchase.amount })),
    };
  }));
  const mortgages = await Promise.all((await findMortgagesByUserId(userId)).map(async (mortgage) => {
    const events = await findEventsByMortgageId(mortgage.id);
    const simulation = simulateMortgage(toTerms(mortgage), events.map(toDomainEvent), today);
    const payments = simulation.rows
      .filter((row) => row.kind === 'scheduled' && row.status !== 'paid')
      .map((row) => ({ date: row.date, amount: row.expected, balanceAfter: row.balanceAfter }));
    return { balance: simulation.balance, payments };
  }));

  const spending = buildCardSpending(today, months, perCard.flatMap((item) => item.purchases));
  const spent = new Set(spending.flatMap((month) => Object.keys(month.byCard)));
  return {
    debtLoad: buildDebtLoad({ today, months, cardPayments: perCard.flatMap((item) => item.payments), mortgages }),
    cardSpending: {
      cards: perCard.filter(({ card }) => spent.has(card.id)).map(({ card }) => ({ id: card.id, name: card.name, kind: card.kind })),
      months: spending,
    },
  };
}

/** Mortgages in the shape of dashboard cards: principal balance, overdue and this month's payments. */
async function getMortgageSummaries(userId: string, today: string, monthEndDate: string, horizonDate: string) {
  const mortgages = await findMortgagesByUserId(userId);
  return Promise.all(mortgages.map(async (mortgage) => {
    const events = await findEventsByMortgageId(mortgage.id);
    const simulation = simulateMortgage(toTerms(mortgage), events.map(toDomainEvent), today);
    const scheduled = simulation.rows.filter((row) => row.kind === 'scheduled');
    const overdue = scheduled.filter((row) => row.status === 'overdue');
    const upcomingThisMonth = scheduled.filter(
      (row) => row.status === 'planned' && row.date >= today && row.date <= monthEndDate
    );
    const upcoming = scheduled.filter((row) => row.status === 'planned' && row.date >= today && row.date <= horizonDate);
    const toPayment = (row: (typeof scheduled)[number], status: 'overdue' | 'upcoming') => ({
      cardId: mortgage.id,
      cardName: mortgage.name,
      kind: 'mortgage' as const,
      dueDate: row.date,
      amount: row.expected,
      status,
      parts: 1,
      mortgage: { number: row.number ?? 0, interest: row.interest },
    });
    return {
      card: {
        id: mortgage.id,
        name: mortgage.name,
        kind: 'mortgage' as const,
        totalRemaining: roundMoney(simulation.balance),
        overdueAmount: simulation.overdueAmount,
        nextDueDate: simulation.nextPayment?.date ?? null,
        nextDueAmount: simulation.nextPayment?.amount ?? 0,
      },
      dueThisMonth: roundMoney(upcomingThisMonth.reduce((sum, row) => sum + row.expected, 0)),
      payments: [
        ...overdue.map((row) => toPayment(row, 'overdue')),
        ...upcoming.map((row) => toPayment(row, 'upcoming')),
      ],
    };
  }));
}

export async function getDashboard(
  cardId: string,
  asOfStr?: string,
  userId?: string
): Promise<DashboardResult | null> {
  const card = await findCardById(cardId);
  if (!card) return null;
  if (userId != null && card.userId !== userId) return null;
  const asOf = asOfStr ? new Date(asOfStr) : new Date();
  const rows = await findBucketsByCardId(cardId);
  const buckets = rows.map((r) => rowToBucket(r, asOf));
  const active = buckets.filter(
    (b) => (b.status === 'active' || b.status === 'overdue') && b.principalRemaining > 0
  );
  const sorted = [...active].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const nextDue = sorted[0] ?? null;
  const totalRemaining = Math.round((active.reduce((s, b) => s + b.principalRemaining, 0) + Number.EPSILON) * 100) / 100;
  const recommendedDeposit = nextDue ? nextDue.principalRemaining : 0;

  const plan = buildPlanForCard(card.kind, buckets, asOf);
  const installmentInfo = card.kind === 'installment' ? await getInstallmentInfo(cardId, rows) : null;
  const listed = installmentInfo
    ? [...buckets].sort((a, b) => {
        const aOpen = a.principalRemaining > 0;
        const bOpen = b.principalRemaining > 0;
        if (aOpen !== bOpen) return aOpen ? -1 : 1;
        return aOpen
          ? a.dueDate.getTime() - b.dueDate.getTime()
          : b.dueDate.getTime() - a.dueDate.getTime();
      })
    : buckets;
  const currentYear = asOf.getFullYear();
  const currentMonth = asOf.getMonth() + 1;
  const late = paysLate(card) ? await getLateSchedule(card, rows, dateOnly(asOf)) : null;
  const currentMonthRow = plan.find((r) => r.year === currentYear && r.month === currentMonth);
  const currentMonthAmount = late
    ? roundMoney(late.filter((row) => row.date.slice(0, 7) <= dateOnly(asOf).slice(0, 7)).reduce((sum, row) => sum + row.amount, 0))
    : currentMonthRow ? currentMonthRow.amount : 0;

  return {
    currentMonthAmount,
    nextDueDate: nextDue ? nextDue.dueDate.toISOString().slice(0, 10) : null,
    totalRemaining,
    recommendedDeposit,
    buckets: listed.map((b) => ({
      id: b.id,
      statementPeriodStart: b.statementPeriodStart,
      principalRemaining: b.principalRemaining,
      dueDate: b.dueDate.toISOString().slice(0, 10),
      status: b.status,
      ...(installmentInfo?.has(b.id) ? { installment: installmentInfo.get(b.id) } : {}),
    })),
  };
}

async function getInstallmentInfo(cardId: string, rows: GraceBucketRow[]) {
  const purchases = new Map((await findPurchasesByCardId(cardId)).map((purchase) => [purchase.id, purchase]));
  const info = new Map<string, NonNullable<DashboardResult['buckets'][number]['installment']>>();
  for (const row of rows) {
    if (!row.purchaseId || row.installmentNumber == null) continue;
    const purchase = purchases.get(row.purchaseId);
    info.set(row.id, {
      number: row.installmentNumber,
      count: purchase?.installmentCount ?? row.installmentNumber,
      description: purchase?.description ?? null,
    });
  }
  return info;
}
