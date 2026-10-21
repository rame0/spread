import type { CardSettings, GraceModel, StatementPeriodStart } from './types';
import { lastDayOfMonth } from './statement-period';
import { getGraceDueDate } from './grace-due';

export interface CardSettingsInput {
  graceModel?: GraceModel;
  reportDay?: number;
  gracePeriods?: number;
  graceDueDay?: number;
  graceStatementPeriods?: number;
  paymentDueOffsetDays?: number;
}

export function resolveCardSettings(input: CardSettingsInput): CardSettings {
  const reportDay = requireInteger(input.reportDay, 'reportDay');
  const graceModel = input.graceModel ?? 'statement_periods';

  if (graceModel === 'legacy_months') {
    const gracePeriods = requireInteger(input.gracePeriods ?? 4, 'gracePeriods');
    const graceDueDay = requireInteger(input.graceDueDay ?? reportDay, 'graceDueDay');
    return {
      graceModel,
      reportDay,
      gracePeriods,
      graceDueDay,
      graceStatementPeriods: requireInteger(
        input.graceStatementPeriods ?? gracePeriods,
        'graceStatementPeriods'
      ),
      paymentDueOffsetDays: requireInteger(
        input.paymentDueOffsetDays ?? 0,
        'paymentDueOffsetDays'
      ),
    };
  }

  if (graceModel === 'ozon_anchor') {
    return {
      graceModel,
      reportDay,
      gracePeriods: requireInteger(input.gracePeriods ?? 2, 'gracePeriods'),
      graceDueDay: requireInteger(input.graceDueDay ?? reportDay, 'graceDueDay'),
      graceStatementPeriods: requireInteger(
        input.graceStatementPeriods ?? 2,
        'graceStatementPeriods'
      ),
      paymentDueOffsetDays: requireInteger(
        input.paymentDueOffsetDays ?? 16,
        'paymentDueOffsetDays'
      ),
    };
  }

  const graceStatementPeriods = requireInteger(
    input.graceStatementPeriods,
    'graceStatementPeriods'
  );
  const paymentDueOffsetDays = requireInteger(
    input.paymentDueOffsetDays,
    'paymentDueOffsetDays'
  );
  return {
    graceModel,
    reportDay,
    gracePeriods: requireInteger(input.gracePeriods ?? graceStatementPeriods, 'gracePeriods'),
    graceDueDay: requireInteger(input.graceDueDay ?? reportDay, 'graceDueDay'),
    graceStatementPeriods,
    paymentDueOffsetDays,
  };
}

export function getBucketPeriodStart(
  purchaseDate: Date,
  settings: CardSettings,
  existingStartDates: Date[] = []
): Date {
  if (settings.graceModel === 'ozon_anchor') {
    return getOzonBucketStartDate(purchaseDate, existingStartDates);
  }

  const period = getMonthlyPeriodStart(purchaseDate, settings.reportDay);
  return new Date(period.year, period.month - 1, 1);
}

export function getBucketDueDate(
  periodStart: StatementPeriodStart,
  settings: CardSettings,
  periodStartDate?: Date
): Date {
  if (settings.graceModel === 'legacy_months') {
    return getGraceDueDate(periodStart, settings.gracePeriods, settings.graceDueDay);
  }
  if (settings.graceModel === 'ozon_anchor') {
    if (!periodStartDate) throw new Error('periodStartDate is required for ozon_anchor');
    return getOzonDueDate(periodStartDate);
  }
  return getStatementBasedDueDate(
    periodStart,
    settings.reportDay,
    settings.graceStatementPeriods,
    settings.paymentDueOffsetDays
  );
}

/** Statement period a purchase falls into and the date it must be repaid by. */
export function getPurchaseDueDate(
  purchaseDate: Date,
  settings: CardSettings,
  existingStartDates: Date[] = []
): { periodStartDate: Date; period: StatementPeriodStart; dueDate: Date } {
  const periodStartDate = getBucketPeriodStart(purchaseDate, settings, existingStartDates);
  const period =
    settings.graceModel === 'ozon_anchor'
      ? { year: periodStartDate.getFullYear(), month: periodStartDate.getMonth() + 1 }
      : getMonthlyPeriodStart(purchaseDate, settings.reportDay);
  return { periodStartDate, period, dueDate: getBucketDueDate(period, settings, periodStartDate) };
}

export function getMonthlyPeriodStart(date: Date, reportDay: number): StatementPeriodStart {
  const day = date.getDate();
  let year = date.getFullYear();
  let month = date.getMonth() + 1;

  if (day <= reportDay) {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  }

  return { year, month };
}

export function getOzonBucketStartDate(purchaseDate: Date, existingStartDates: Date[]): Date {
  if (existingStartDates.length === 0) {
    return new Date(
      purchaseDate.getFullYear(),
      purchaseDate.getMonth(),
      purchaseDate.getDate()
    );
  }

  const sorted = [...existingStartDates].sort((a, b) => a.getTime() - b.getTime());
  const latest = sorted[sorted.length - 1];

  for (let i = sorted.length - 1; i >= 0; i--) {
    const start = sorted[i];
    const next = addCalendarMonths(start, 2);
    if (purchaseDate >= start && purchaseDate < next) {
      return new Date(start.getFullYear(), start.getMonth(), start.getDate());
    }
  }

  let candidate = latest;
  while (purchaseDate >= addCalendarMonths(candidate, 2)) {
    candidate = addCalendarMonths(candidate, 2);
  }
  return new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate());
}

export function getOzonDueDate(bucketStartDate: Date): Date {
  const dueDate = addCalendarMonths(bucketStartDate, 2);
  dueDate.setDate(dueDate.getDate() + 15);
  return dueDate;
}

export function getStatementBasedDueDate(
  periodStart: StatementPeriodStart,
  reportDay: number,
  graceStatementPeriods: number,
  paymentDueOffsetDays: number
): Date {
  const duePeriodStart = addMonths(periodStart, Math.max(0, graceStatementPeriods - 1));
  const closeDate = getStatementCloseDate(duePeriodStart, reportDay);
  const dueDate = new Date(closeDate);
  dueDate.setDate(dueDate.getDate() + paymentDueOffsetDays);
  return dueDate;
}

export function getStatementCloseDate(
  periodStart: StatementPeriodStart,
  reportDay: number
): Date {
  const closeMonth = addMonths(periodStart, 1);
  const day = Math.min(reportDay, lastDayOfMonth(closeMonth.year, closeMonth.month));
  return new Date(closeMonth.year, closeMonth.month - 1, day);
}

function addMonths(periodStart: StatementPeriodStart, delta: number): StatementPeriodStart {
  const month0 = periodStart.month - 1 + delta;
  return {
    year: periodStart.year + Math.floor(month0 / 12),
    month: (month0 % 12) + 1,
  };
}

export function addCalendarMonths(date: Date, delta: number): Date {
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth() + delta;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const day = Math.min(date.getDate(), lastDay);
  return new Date(targetYear, targetMonth, day);
}

function requireInteger(value: number | undefined, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`${field} is required`);
  }
  return value;
}
