import { buildCardSpending, buildDebtLoad, monthKeys } from '../overview-charts';

describe('overview charts', () => {
  it('lists month keys across a year boundary', () => {
    expect(monthKeys('2026-11-15', 0, 3)).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(monthKeys('2026-02-28', -2, 3)).toEqual(['2025-12', '2026-01', '2026-02']);
  });

  it('splits debt payments by kind and month, overdue ones into the current month', () => {
    const load = buildDebtLoad({
      today: '2026-10-22',
      months: 3,
      cardPayments: [
        { kind: 'credit', dueDate: '2026-09-30', amount: 100 },
        { kind: 'credit', dueDate: '2026-11-14', amount: 200 },
        { kind: 'installment', dueDate: '2026-10-29', amount: 50 },
        { kind: 'installment', dueDate: '2026-11-12', amount: 50 },
      ],
      mortgages: [],
    });

    expect(load.map(({ credit, installment }) => [credit, installment])).toEqual([[100, 50], [200, 50], [0, 0]]);
    expect(load.map((month) => month.cardDebtEnd)).toEqual([250, 0, 0]);
  });

  it('follows the mortgage principal after each payment', () => {
    const load = buildDebtLoad({
      today: '2026-10-22',
      months: 3,
      cardPayments: [],
      mortgages: [{
        balance: 1000,
        payments: [
          { date: '2026-11-15', amount: 120, balanceAfter: 900 },
          { date: '2026-12-15', amount: 120, balanceAfter: 800 },
        ],
      }],
    });

    expect(load.map(({ mortgage, mortgageEnd }) => [mortgage, mortgageEnd])).toEqual([[0, 1000], [120, 900], [120, 800]]);
  });

  it('sums purchases per card in the last months and ignores the rest', () => {
    const spending = buildCardSpending('2026-10-22', 2, [
      { cardId: 'a', date: '2026-10-01', amount: 10 },
      { cardId: 'a', date: '2026-10-05', amount: 5.5 },
      { cardId: 'b', date: '2026-09-10', amount: 7 },
      { cardId: 'b', date: '2026-08-31', amount: 1000 },
      { cardId: 'b', date: '2026-10-23', amount: 1000 },
    ]);

    expect(spending).toEqual([
      { month: '2026-09', total: 7, byCard: { b: 7 } },
      { month: '2026-10', total: 15.5, byCard: { a: 15.5 } },
    ]);
  });
});
