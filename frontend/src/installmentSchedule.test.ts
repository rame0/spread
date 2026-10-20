import { describe, expect, it } from 'vitest';
import { buildInstallmentSchedule, defaultFirstPaymentDate } from './installmentSchedule';

describe('installment schedule preview', () => {
  it('matches the backend split rules', () => {
    expect(buildInstallmentSchedule({
      amount: 1000,
      fee: 0.01,
      count: 3,
      interval: 'month',
      firstPaymentDate: '2028-01-31',
    })).toEqual([
      { number: 1, dueDate: '2028-01-31', amount: 333.33 },
      { number: 2, dueDate: '2028-02-29', amount: 333.33 },
      { number: 3, dueDate: '2028-03-31', amount: 333.35 },
    ]);
  });

  it('defaults the first payment to one interval after purchase', () => {
    expect(defaultFirstPaymentDate('2026-06-01', '2weeks')).toBe('2026-06-15');
  });

  it('returns an empty preview for incomplete input', () => {
    expect(buildInstallmentSchedule({ amount: 0, fee: 0, count: 4, interval: 'week', firstPaymentDate: '2026-01-01' })).toEqual([]);
  });
});
