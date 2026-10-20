import {
  buildInstallmentSchedule,
  defaultFirstPaymentDate,
} from '../installment-schedule';

describe('installment schedule', () => {
  it('splits purchase into equal biweekly payments', () => {
    const schedule = buildInstallmentSchedule({
      amount: 12000,
      fee: 0,
      count: 4,
      interval: '2weeks',
      firstPaymentDate: '2026-06-15',
    });

    expect(schedule).toEqual([
      { number: 1, dueDate: '2026-06-15', amount: 3000 },
      { number: 2, dueDate: '2026-06-29', amount: 3000 },
      { number: 3, dueDate: '2026-07-13', amount: 3000 },
      { number: 4, dueDate: '2026-07-27', amount: 3000 },
    ]);
  });

  it('puts kopeck remainder into the last payment and spreads the fee', () => {
    const schedule = buildInstallmentSchedule({
      amount: 1000,
      fee: 0.01,
      count: 3,
      interval: 'week',
      firstPaymentDate: '2026-12-28',
    });

    expect(schedule.map((payment) => payment.amount)).toEqual([333.33, 333.33, 333.35]);
    expect(schedule.map((payment) => payment.dueDate)).toEqual(['2026-12-28', '2027-01-04', '2027-01-11']);
    const total = schedule.reduce((sum, payment) => sum + Math.round(payment.amount * 100), 0);
    expect(total).toBe(100001);
  });

  it('keeps the payment day after short months', () => {
    const schedule = buildInstallmentSchedule({
      amount: 400,
      fee: 0,
      count: 4,
      interval: 'month',
      firstPaymentDate: '2028-01-31',
    });

    expect(schedule.map((payment) => payment.dueDate)).toEqual([
      '2028-01-31',
      '2028-02-29',
      '2028-03-31',
      '2028-04-30',
    ]);
  });

  it('defaults the first payment to one interval after the purchase', () => {
    expect(defaultFirstPaymentDate('2026-01-31', 'month')).toBe('2026-02-28');
    expect(defaultFirstPaymentDate('2026-06-01', '2weeks')).toBe('2026-06-15');
    expect(defaultFirstPaymentDate('2026-06-01', 'week')).toBe('2026-06-08');
  });

  it('rejects invalid plans', () => {
    const base = { amount: 100, fee: 0, count: 2, interval: 'month' as const, firstPaymentDate: '2026-01-01' };
    expect(() => buildInstallmentSchedule({ ...base, count: 0 })).toThrow();
    expect(() => buildInstallmentSchedule({ ...base, fee: -1 })).toThrow();
  });
});
