import { buildPlanForCard } from '../domain/plan';
import { findCardById, findCardsByUserId } from '../repositories/cardRepository';
import { findBucketsByCardId } from '../repositories/graceBucketRepository';
import { findPurchasesByCardId } from '../repositories/purchaseRepository';
import { findEventsByMortgageId, findMortgagesByUserId } from '../repositories/mortgageRepository';
import { simulateMortgage } from '../domain/mortgage-schedule';
import { toDomainEvent, toTerms } from './mortgageService';
import type { GraceBucketRow } from '../repositories/graceBucketRepository';
import type { GraceBucket } from '../domain/types';

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
    const buckets = (await findBucketsByCardId(card.id)).map((row) => rowToBucket(row, asOf));
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
    const plan = buildPlanForCard(card.kind, buckets, asOf);
    const plannedThisMonth = plan.find((row) => row.year === asOf.getFullYear() && row.month === asOf.getMonth() + 1)?.amount ?? 0;
    const nextDue = [...active].sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime())[0];

    return {
      card: {
        id: card.id,
        name: card.name,
        kind: card.kind as DebtKind,
        totalRemaining,
        overdueAmount,
        nextDueDate: nextDue ? dateOnly(nextDue.dueDate) : null,
        nextDueAmount: nextDue?.principalRemaining ?? 0,
      },
      overdue,
      upcoming,
      upcomingThisMonth,
      plannedThisMonth,
    };
  }));

  const paymentsByCardAndDate = new Map<string, MainDashboardResult['payments'][number]>();
  for (const { card, overdue, upcoming } of cardResults) {
    for (const bucket of [...overdue, ...upcoming]) {
      const dueDate = dateOnly(bucket.dueDate);
      const key = `${card.id}:${dueDate}`;
      const existing = paymentsByCardAndDate.get(key);
      if (existing) {
        existing.amount = roundMoney(existing.amount + bucket.principalRemaining);
      } else {
        paymentsByCardAndDate.set(key, {
          cardId: card.id,
          cardName: card.name,
          kind: card.kind as DebtKind,
          dueDate,
          amount: bucket.principalRemaining,
          status: dueDate < today ? 'overdue' : 'upcoming',
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
      cardResults.reduce((sum, item) => sum + item.upcomingThisMonth.reduce((amount, bucket) => amount + bucket.principalRemaining, 0), 0) +
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
  const currentMonthRow = plan.find((r) => r.year === currentYear && r.month === currentMonth);
  const currentMonthAmount = currentMonthRow ? currentMonthRow.amount : 0;

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
