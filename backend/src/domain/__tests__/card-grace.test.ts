import { getBucketDueDate, getStatementCloseDate, resolveCardSettings } from '../card-grace';

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

  it('calculates Ozon-style due date as next statement close plus 16 days', () => {
    const settings = resolveCardSettings({
      graceModel: 'statement_periods',
      reportDay: 10,
      graceStatementPeriods: 2,
      paymentDueOffsetDays: 16,
    });

    const due = getBucketDueDate({ year: 2025, month: 1 }, settings);
    expect([due.getFullYear(), due.getMonth(), due.getDate()]).toEqual([2025, 2, 26]);
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
