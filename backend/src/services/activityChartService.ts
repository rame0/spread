import { findCardById } from '../repositories/cardRepository';
import { findDepositsByCardId } from '../repositories/depositRepository';
import { findPurchasesByCardId } from '../repositories/purchaseRepository';

export type ActivityChartPeriod = '6m' | '12m' | 'all';
export type ActivityChartGranularity = 'day' | 'week' | 'month';

interface ActivityItem {
  date: string;
  amount: number;
}

export interface ActivityChartPoint {
  startDate: string;
  endDate: string;
  amount: number;
}

export interface ActivityChartResult {
  period: ActivityChartPeriod;
  granularity: ActivityChartGranularity;
  purchases: ActivityChartPoint[];
  deposits: ActivityChartPoint[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dateFromString(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateToString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function startOfUtcMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function addUtcDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS);
}

function addUtcMonths(value: Date, months: number): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));
}

function minDate(left: Date, right: Date): Date {
  return left.getTime() <= right.getTime() ? left : right;
}

function endOfUtcWeek(value: Date): Date {
  const daysUntilSunday = (7 - value.getUTCDay()) % 7;
  return addUtcDays(value, daysUntilSunday);
}

function getGranularity(period: ActivityChartPeriod): ActivityChartGranularity {
  if (period === '6m') return 'day';
  if (period === '12m') return 'week';
  return 'month';
}

function getRangeStart(period: ActivityChartPeriod, asOf: Date, firstDate?: Date): Date | null {
  const monthStart = startOfUtcMonth(asOf);
  if (period === '6m') return addUtcMonths(monthStart, -5);
  if (period === '12m') return addUtcMonths(monthStart, -11);
  return firstDate ? startOfUtcMonth(firstDate) : null;
}

function getBuckets(start: Date, end: Date, granularity: ActivityChartGranularity): Array<{ start: Date; end: Date }> {
  const buckets: Array<{ start: Date; end: Date }> = [];
  let cursor = start;

  while (cursor.getTime() <= end.getTime()) {
    let bucketEnd: Date;
    if (granularity === 'day') {
      bucketEnd = cursor;
    } else if (granularity === 'week') {
      bucketEnd = minDate(endOfUtcWeek(cursor), end);
    } else {
      bucketEnd = minDate(addUtcDays(addUtcMonths(startOfUtcMonth(cursor), 1), -1), end);
    }
    buckets.push({ start: cursor, end: bucketEnd });
    cursor = addUtcDays(bucketEnd, 1);
  }

  return buckets;
}

function aggregate(items: ActivityItem[], buckets: Array<{ start: Date; end: Date }>): ActivityChartPoint[] {
  const amountsByDate = new Map<string, number>();
  for (const item of items) {
    const cents = Math.round((item.amount + Number.EPSILON) * 100);
    amountsByDate.set(item.date, (amountsByDate.get(item.date) ?? 0) + cents);
  }

  return buckets.map(({ start, end }) => {
    let cents = 0;
    for (let date = start; date.getTime() <= end.getTime(); date = addUtcDays(date, 1)) {
      cents += amountsByDate.get(dateToString(date)) ?? 0;
    }
    return {
      startDate: dateToString(start),
      endDate: dateToString(end),
      amount: cents / 100,
    };
  });
}

export function buildActivityChart(
  period: ActivityChartPeriod,
  purchases: ActivityItem[],
  deposits: ActivityItem[],
  asOf = new Date()
): ActivityChartResult {
  const end = startOfUtcDay(asOf);
  const allItems = [...purchases, ...deposits].filter((item) => dateFromString(item.date).getTime() <= end.getTime());
  const firstDate = allItems
    .map((item) => dateFromString(item.date))
    .sort((left, right) => left.getTime() - right.getTime())[0];
  const start = getRangeStart(period, end, firstDate);
  const granularity = getGranularity(period);

  if (!start) {
    return { period, granularity, purchases: [], deposits: [] };
  }

  const buckets = getBuckets(start, end, granularity);
  const inRange = (item: ActivityItem) => {
    const date = dateFromString(item.date).getTime();
    return date >= start.getTime() && date <= end.getTime();
  };

  return {
    period,
    granularity,
    purchases: aggregate(purchases.filter(inRange), buckets),
    deposits: aggregate(deposits.filter(inRange), buckets),
  };
}

export async function getActivityChart(
  cardId: string,
  period: ActivityChartPeriod,
  userId?: string
): Promise<ActivityChartResult | null> {
  const card = await findCardById(cardId);
  if (!card || (userId != null && card.userId !== userId)) return null;

  const [purchases, deposits] = await Promise.all([
    findPurchasesByCardId(cardId),
    findDepositsByCardId(cardId),
  ]);

  return buildActivityChart(
    period,
    purchases.map((item) => ({ date: item.purchaseDate, amount: item.amount })),
    deposits.map((item) => ({ date: item.depositDate, amount: item.amount }))
  );
}
