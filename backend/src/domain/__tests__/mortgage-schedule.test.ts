import {
  accruedInterest,
  annuityPayment,
  mortgagePaymentDate,
  paymentsToMarkPaid,
  simulateMortgage,
  type MortgageEvent,
  type MortgageTerms,
} from '../mortgage-schedule';

const terms: MortgageTerms = {
  principal: 1_200_000,
  issueDate: '2026-01-15',
  annualRate: 12,
  termMonths: 12,
  paymentDay: 15,
  firstPaymentInterestOnly: true,
};

const scheduled = (events: MortgageEvent[] = [], asOf = '2026-01-15', base = terms) =>
  simulateMortgage(base, events, asOf).rows.filter((row) => row.kind === 'scheduled');

describe('mortgage schedule', () => {
  it('calculates the annuity by the Sberbank formula', () => {
    expect(annuityPayment(5_000_000, 6, 240)).toBe(35821.55);
  });

  it('accrues interest by actual days with 365/366 split at the new year', () => {
    const interest = accruedInterest(1_000_000, 10, '2027-12-15', '2028-01-15');
    expect(Math.round(interest * 100) / 100).toBe(8481.92);
  });

  it('falls back to the last day of short months', () => {
    expect([1, 2, 3].map((index) => mortgagePaymentDate('2026-01-31', 31, index))).toEqual([
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('starts with an interest-only payment and repays the loan by maturity', () => {
    const rows = scheduled();
    expect(rows).toHaveLength(12);
    expect(rows[0]).toMatchObject({ date: '2026-02-15', interest: 12230.14, principal: 0, expected: 12230.14 });
    expect(rows[1].expected).toBe(annuityPayment(1_200_000, 12, 11));
    expect(rows[11].date).toBe('2027-01-15');
    expect(rows[11].balanceAfter).toBe(0);
    const repaid = rows.reduce((sum, row) => sum + Math.round(row.principal * 100), 0);
    expect(repaid).toBe(120_000_000);
  });

  it('uses a full annuity from the first payment when configured', () => {
    const rows = scheduled([], '2026-01-15', { ...terms, firstPaymentInterestOnly: false });
    expect(rows[0].expected).toBe(annuityPayment(1_200_000, 12, 12));
    expect(rows[0].principal).toBeGreaterThan(0);
  });

  it('marks missed payments overdue without reducing the balance', () => {
    const simulation = simulateMortgage(terms, [], '2026-04-01');
    const rows = simulation.rows.filter((row) => row.kind === 'scheduled');
    expect(rows.slice(0, 3).map((row) => row.status)).toEqual(['overdue', 'overdue', 'planned']);
    expect(simulation.balance).toBe(1_200_000);
    expect(simulation.overdueAmount).toBe(Math.round((rows[0].expected + rows[1].expected) * 100) / 100);
    // Unpaid interest is carried into the next payment.
    expect(rows[2].interest).toBeGreaterThan(rows[2].expected - rows[2].principal - 0.01);
  });

  it('matches recorded payments within the window around the payment date', () => {
    const plan = scheduled();
    const events: MortgageEvent[] = [
      { kind: 'payment', date: '2026-02-13', amount: plan[0].expected },
      { kind: 'payment', date: '2026-03-18', amount: plan[1].expected },
    ];
    const simulation = simulateMortgage(terms, events, '2026-04-01');
    const rows = simulation.rows.filter((row) => row.kind === 'scheduled');
    expect(rows.slice(0, 2).map((row) => row.status)).toEqual(['paid', 'paid']);
    expect(simulation.balance).toBe(plan[1].balanceAfter);
    expect(simulation.nextPayment).toEqual({ date: '2026-04-15', amount: plan[2].expected });
  });

  it('puts a prepayment on the payment date fully into principal and lowers the payment', () => {
    const plan = scheduled();
    const rows = simulateMortgage(
      terms,
      [{ kind: 'prepayment', date: '2026-03-15', amount: 100_000, mode: 'reduce_payment' }],
      '2026-01-15'
    ).rows;
    const prepayment = rows.find((row) => row.kind === 'prepayment')!;
    expect(prepayment).toMatchObject({ interest: 0, principal: 100_000 });
    expect(prepayment.balanceAfter).toBe(Math.round((plan[1].balanceAfter - 100_000) * 100) / 100);
    const after = rows.filter((row) => row.kind === 'scheduled');
    expect(after[2].expected).toBe(annuityPayment(prepayment.balanceAfter, 12, 10));
    expect(after).toHaveLength(12);
  });

  it('keeps the payment and shortens the term for reduce_term', () => {
    const plan = scheduled();
    const after = scheduled([{ kind: 'prepayment', date: '2026-03-15', amount: 300_000, mode: 'reduce_term' }]);
    expect(after[2].expected).toBe(plan[2].expected);
    expect(after.length).toBeLessThan(plan.length);
    expect(after[after.length - 1].balanceAfter).toBe(0);
  });

  it('pays accrued interest first when prepaying between payment dates', () => {
    const plan = scheduled();
    const rows = simulateMortgage(
      terms,
      [{ kind: 'prepayment', date: '2026-03-25', amount: 50_000, mode: 'reduce_payment' }],
      '2026-01-15'
    ).rows;
    const prepayment = rows.find((row) => row.kind === 'prepayment')!;
    const expectedInterest = Math.round(accruedInterest(plan[1].balanceAfter, 12, '2026-03-15', '2026-03-25') * 100) / 100;
    expect(prepayment.interest).toBe(expectedInterest);
    expect(prepayment.principal).toBe(Math.round((50_000 - expectedInterest) * 100) / 100);
    const april = rows.find((row) => row.date === '2026-04-15')!;
    const aprilInterest = Math.round(accruedInterest(prepayment.balanceAfter, 12, '2026-03-25', '2026-04-15') * 100) / 100;
    expect(april.interest).toBe(aprilInterest);
  });

  it('recalculates the annuity after a rate change', () => {
    const plan = scheduled();
    const rows = scheduled([{ kind: 'rate_change', date: '2026-04-01', rate: 20 }]);
    // April keeps the old annuity, the new one applies from May.
    expect(rows[2].expected).toBe(plan[2].expected);
    expect(rows[2].interest).toBeGreaterThan(plan[2].interest);
    expect(rows[3].expected).toBe(annuityPayment(rows[2].balanceAfter, 20, 9));
  });

  it('reports the payment and rate in effect on the as-of date', () => {
    const events: MortgageEvent[] = [{ kind: 'rate_change', date: '2026-06-01', rate: 20 }];
    const before = simulateMortgage(terms, events, '2026-05-20');
    expect(before.rate).toBe(12);
    expect(before.currentPayment).toBe(annuityPayment(1_200_000, 12, 11));
    const after = simulateMortgage(terms, events, '2026-06-20');
    expect(after.rate).toBe(20);
    expect(after.currentPayment).toBe(after.rows.find((row) => row.date === '2026-07-15')!.expected);
  });

  it('replaces the balance with the bank figure on reconciliation', () => {
    const plan = scheduled();
    const actualBalance = Math.round((plan[1].balanceAfter - 10) * 100) / 100;
    const rows = simulateMortgage(
      terms,
      [{ kind: 'reconciliation', date: '2026-03-15', actualBalance }],
      '2026-01-15'
    ).rows;
    const reconciliation = rows.find((row) => row.kind === 'reconciliation')!;
    expect(reconciliation.difference).toBe(-10);
    const april = rows.find((row) => row.date === '2026-04-15')!;
    expect(april.balanceAfter).toBe(Math.round((actualBalance - april.principal) * 100) / 100);
  });

  it('creates payments for every unpaid date up to the given day', () => {
    const payments = paymentsToMarkPaid(terms, [], '2026-04-20');
    expect(payments.map((payment) => payment.date)).toEqual(['2026-02-15', '2026-03-15', '2026-04-15']);
    const simulation = simulateMortgage(terms, payments.map((payment) => ({ kind: 'payment' as const, ...payment })), '2026-05-01');
    expect(simulation.overdueAmount).toBe(0);
    expect(simulation.balance).toBe(scheduled()[2].balanceAfter);
  });
});
