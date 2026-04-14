import {
  getBucketDueDate,
  getBucketPeriodStart,
  getStatementCloseDate,
  resolveCardSettings,
} from '../card-grace';

describe('card grace settings', () => {
  it('keeps legacy month-based due date behavior', () => {
    const settings = resolveCardSettings({
      graceModel: 'legacy_months',
      reportDay: 10,
      gracePeriods: 4,
      graceDueDay: 10,
    });

    const due = getBucketDueDate({ year: 2025, month: 1 }, settings);
    expect([due.getFullYear(), due.getMonth(), due.getDate()]).toEqual([2025, 4, 10]);
  });

  it('calculates Ozon-style due date from 2-month bucket start plus 16 days', () => {
    const settings = resolveCardSettings({
      graceModel: 'ozon_anchor',
      reportDay: 12,
      graceStatementPeriods: 2,
      paymentDueOffsetDays: 16,
    });

    const start = getBucketPeriodStart(new Date(2025, 4, 12), settings, []);
    const due = getBucketDueDate({ year: 2025, month: 5 }, settings, start);
    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([2025, 4, 12]);
    expect([due.getFullYear(), due.getMonth(), due.getDate()]).toEqual([2025, 6, 27]);
  });

  it('keeps later Ozon purchases in same 2-month bucket', () => {
    const settings = resolveCardSettings({
      graceModel: 'ozon_anchor',
      reportDay: 12,
      graceStatementPeriods: 2,
      paymentDueOffsetDays: 16,
    });

    const existing = [new Date(2025, 4, 12)];
    const start = getBucketPeriodStart(new Date(2025, 5, 30), settings, existing);
    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([2025, 4, 12]);
  });

  it('starts new Ozon bucket after 2-month purchase window', () => {
    const settings = resolveCardSettings({
      graceModel: 'ozon_anchor',
      reportDay: 12,
      graceStatementPeriods: 2,
      paymentDueOffsetDays: 16,
    });

    const existing = [new Date(2025, 4, 12)];
    const start = getBucketPeriodStart(new Date(2025, 6, 12), settings, existing);
    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([2025, 6, 12]);
  });

  it('calculates newer Sber 120 as 4 statement periods with due on final close date', () => {
    const settings = resolveCardSettings({
      graceModel: 'statement_periods',
      reportDay: 10,
      graceStatementPeriods: 4,
      paymentDueOffsetDays: 0,
    });

    const due = getBucketDueDate({ year: 2025, month: 1 }, settings);
    expect([due.getFullYear(), due.getMonth(), due.getDate()]).toEqual([2025, 4, 10]);
  });

  it('normalizes statement close to last day of shorter month', () => {
    const close = getStatementCloseDate({ year: 2025, month: 1 }, 31);
    expect([close.getFullYear(), close.getMonth(), close.getDate()]).toEqual([2025, 1, 28]);
  });
});
