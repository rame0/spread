import { addMonths, simulateSavings, type SavingsEvent, type SavingsTerms } from '../savings';

const daily: SavingsTerms = { mode: 'daily', payoutDay: null, maturityDate: null };
const monthly = (payoutDay: number | null = null): SavingsTerms => ({ mode: 'monthly', payoutDay, maturityDate: null });

const open = (date: string, amount: number, rate: number): SavingsEvent[] => [
  { date, kind: 'top_up', amount },
  { date, kind: 'rate_change', rate },
];

describe('savings interest', () => {
  it('capitalizes daily interest rounded to kopecks', () => {
    // 2025 is not a leap year: 100 000 × 16% / 365 = 43.84 a day on the first day.
    const result = simulateSavings(daily, open('2025-01-01', 100000, 16), [], '2025-01-31');
    let expected = 100000;
    for (let day = 0; day < 30; day++) expected = Math.round((expected + (expected * 0.16) / 365) * 100) / 100;
    expect(result.balance).toBeCloseTo(expected, 2);
    expect(result.balance).toBeCloseTo(100000 * (1 + 0.16 / 365) ** 30, 0);
    expect(result.accrued).toBeCloseTo((result.balance * 0.16) / 365, 2);
    expect(result.incomeByMonth).toEqual([{ month: '2025-01', amount: Math.round((result.balance - 100000) * 100) / 100 }]);
  });

  it('uses 366 days in a leap year', () => {
    const result = simulateSavings(daily, open('2024-03-01', 366000, 10), [], '2024-03-02');
    expect(result.balance).toBe(366100);
  });

  it('pays monthly interest on the payout day and the last day of short months', () => {
    const result = simulateSavings(monthly(31), open('2025-01-31', 365000, 10), [], '2025-03-31');
    // 28 days of February at 100 ₽ a day are paid on February 28.
    expect(result.incomeByMonth).toEqual([
      { month: '2025-02', amount: 2800 },
      { month: '2025-03', amount: Math.round((365000 + 2800) * 0.1 / 365 * 31 * 100) / 100 },
    ]);
    expect(result.accrued).toBeCloseTo((result.balance * 0.1) / 365, 2);
  });

  it('applies a rate change from its date', () => {
    const events: SavingsEvent[] = [...open('2025-04-01', 365000, 10), { date: '2025-04-11', kind: 'rate_change', rate: 20 }];
    const result = simulateSavings(monthly(), events, [], '2025-04-29');
    // 10 days at 100 ₽ and 19 days at 200 ₽, to be paid on April 30.
    expect(result.accrued).toBe(4800);
    expect(result.rate).toBe(20);
  });

  it('accrues on the balance after top-ups and withdrawals', () => {
    const events: SavingsEvent[] = [
      ...open('2025-05-01', 365000, 10),
      { date: '2025-05-11', kind: 'top_up', amount: 365000 },
      { date: '2025-05-21', kind: 'withdrawal', amount: 730000 },
    ];
    const result = simulateSavings(monthly(), events, [], '2025-05-30');
    expect(result.accrued).toBe(1000 + 2000);
    expect(result.balance).toBe(0);
  });

  it('takes the bank balance as the new starting point and keeps unpaid interest', () => {
    const events = open('2025-06-01', 365000, 10);
    const result = simulateSavings(monthly(), events, [{ date: '2025-06-11', amount: 365500 }], '2025-06-20');
    expect(result.reconciliations).toEqual([{ date: '2025-06-11', expected: 365000, actual: 365500, difference: 500 }]);
    expect(result.balance).toBe(365500);
    expect(result.accrued).toBeCloseTo(1000 + ((365500 * 0.1) / 365) * 10, 2);
  });

  it('starts from the first bank balance without reporting a difference', () => {
    const result = simulateSavings(daily, [], [{ date: '2025-01-01', amount: 1000 }], '2025-01-05');
    expect(result.reconciliations).toEqual([]);
    expect(result.balance).toBe(1000);
  });

  it('does not compare the first bank balance with a rate set before it', () => {
    const events: SavingsEvent[] = [{ date: '2025-01-01', kind: 'rate_change', rate: 10 }];
    const result = simulateSavings(daily, events, [{ date: '2025-01-03', amount: 180000 }], '2025-01-05');
    expect(result.reconciliations).toEqual([]);
  });

  it('pays a term deposit on its maturity date and stops accruing', () => {
    const terms: SavingsTerms = { mode: 'maturity', payoutDay: null, maturityDate: '2025-07-11' };
    const result = simulateSavings(terms, open('2025-07-01', 365000, 10), [], '2025-08-31');
    expect(result.balance).toBe(366000);
    expect(result.accrued).toBe(0);
    expect(result.incomeByMonth).toEqual([{ month: '2025-07', amount: 1000 }]);
  });

  it('counts days with money but no rate', () => {
    const result = simulateSavings(daily, [{ date: '2025-01-01', kind: 'top_up', amount: 1000 }], [], '2025-01-10');
    expect(result.daysWithoutRate).toBe(10);
    expect(result.balance).toBe(1000);
  });

  it('reports balances on requested dates and projects forward', () => {
    const result = simulateSavings(monthly(), open('2025-01-15', 365000, 10), [], '2025-12-31', ['2025-01-01', '2025-01-31', '2025-12-31']);
    expect(result.points['2025-01-01']).toBeNull();
    // January 15–30 are paid in the morning of January 31.
    expect(result.points['2025-01-31']).toBe(366600);
    expect(result.points['2025-12-31']).toBe(result.balance);
  });

  it('adds months keeping the day or falling back to the month end', () => {
    expect(addMonths('2025-01-31', 1)).toBe('2025-02-28');
    expect(addMonths('2025-10-21', 12)).toBe('2026-10-21');
  });
});
