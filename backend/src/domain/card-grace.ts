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

export function getBucketDueDate(
  periodStart: StatementPeriodStart,
  settings: CardSettings
): Date {
  if (settings.graceModel === 'legacy_months') {
    return getGraceDueDate(periodStart, settings.gracePeriods, settings.graceDueDay);
  }
  return getStatementBasedDueDate(
    periodStart,
    settings.reportDay,
    settings.graceStatementPeriods,
    settings.paymentDueOffsetDays
  );
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

function requireInteger(value: number | undefined, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`${field} is required`);
  }
  return value;
}
