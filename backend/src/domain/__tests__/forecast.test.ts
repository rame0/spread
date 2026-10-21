import { buildForecast, monthlyAmount, occurrences, planVsFact, type ForecastInput, type PlanItem } from '../forecast';

const item = (overrides: Partial<PlanItem>): PlanItem => ({
  id: 'item',
  kind: 'expense',
  amount: 1000,
  frequency: 'monthly',
  interval: 1,
  startDate: '2026-01-31',
  endDate: null,
  spread: false,
  cardId: null,
  targetAccountId: null,
  ...overrides,
});

const input = (overrides: Partial<ForecastInput>): ForecastInput => ({
  today: '2026-03-01',
  until: '2026-04-30',
  liquidCash: 100000,
  fixedAssets: 0,
  savings: [],
  plainAccounts: [],
  debtPayments: [],
  cardDebt: 0,
  mortgageDebt: 0,
  mortgageBalances: [],
  items: [],
  cardDueDate: () => null,
  ...overrides,
});

describe('plan occurrences', () => {
  it('repeats monthly from the start, keeping the 31st at the month end', () => {
    expect(occurrences(item({}), '2026-01-01', '2026-04-30').map((row) => row.date)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('supports weeks, every N months, years, once and an end date', () => {
    expect(occurrences(item({ frequency: 'weekly', startDate: '2026-03-02' }), '2026-03-01', '2026-03-20').map((row) => row.date)).toEqual([
      '2026-03-02',
      '2026-03-09',
      '2026-03-16',
    ]);
    expect(occurrences(item({ interval: 3, startDate: '2026-01-15' }), '2026-01-01', '2026-12-31').map((row) => row.date)).toEqual([
      '2026-01-15',
      '2026-04-15',
      '2026-07-15',
      '2026-10-15',
    ]);
    expect(occurrences(item({ frequency: 'yearly', startDate: '2024-02-29' }), '2025-01-01', '2026-12-31').map((row) => row.date)).toEqual([
      '2025-02-28',
      '2026-02-28',
    ]);
    expect(occurrences(item({ frequency: 'once', startDate: '2026-05-01' }), '2026-01-01', '2026-12-31')).toHaveLength(1);
    expect(occurrences(item({ startDate: '2026-01-10', endDate: '2026-03-09' }), '2026-01-01', '2026-12-31')).toHaveLength(2);
  });

  it('spreads an expense over the days of its period', () => {
    const rows = occurrences(item({ amount: 3100, startDate: '2026-03-01', spread: true }), '2026-03-10', '2026-03-31');
    expect(rows).toHaveLength(22);
    expect(rows[0]).toEqual({ date: '2026-03-10', amount: 100 });
  });

  it('converts to a monthly amount', () => {
    expect(monthlyAmount({ amount: 1200, frequency: 'yearly', interval: 1 })).toBe(100);
    expect(monthlyAmount({ amount: 300, frequency: 'monthly', interval: 3 })).toBe(100);
    expect(monthlyAmount({ amount: 700, frequency: 'weekly', interval: 1 })).toBeCloseTo(3041.67, 2);
  });
});

describe('cash-flow forecast', () => {
  it('moves free money by income, expenses and debt payments', () => {
    const result = buildForecast(
      input({
        items: [item({ kind: 'income', amount: 50000, startDate: '2026-03-05' }), item({ amount: 20000, startDate: '2026-03-10' })],
        debtPayments: [{ date: '2026-03-15', amount: 30000, kind: 'mortgage' }],
        mortgageDebt: 1000000,
        mortgageBalances: [{ date: '2026-03-15', balance: 990000 }],
      })
    );
    const march = result.months[0];
    expect(march).toMatchObject({ month: '2026-03', income: 50000, expenses: 20000, debtPayments: 30000, liquidEnd: 100000 });
    expect(result.start).toEqual({ liquid: 100000, netWorth: -900000 });
    // The mortgage payment of 30 000 reduces the principal by 10 000.
    expect(march.netWorthEnd).toBe(100000 - 990000);
    // After the mortgage payment free money is back at the starting 100 000, reached first on March 1.
    expect(result.minLiquid).toEqual({ date: '2026-03-01', amount: 100000 });
  });

  it('pays a card expense on the card due date', () => {
    const result = buildForecast(
      input({
        items: [item({ amount: 30000, frequency: 'once', startDate: '2026-03-10', cardId: 'card' })],
        cardDueDate: () => '2026-04-25',
      })
    );
    expect(result.daily.find((row) => row.date === '2026-03-31')).toEqual({ date: '2026-03-31', liquid: 100000, netWorth: 70000 });
    expect(result.daily.find((row) => row.date === '2026-04-25')).toEqual({ date: '2026-04-25', liquid: 70000, netWorth: 70000 });
    expect(result.months.map((row) => [row.cardSpending, row.debtPayments])).toEqual([
      [30000, 0],
      [0, 30000],
    ]);
  });

  it('keeps net worth on a transfer to a deposit and adds its interest', () => {
    const result = buildForecast(
      input({
        items: [item({ kind: 'transfer', amount: 36500, frequency: 'once', startDate: '2026-03-01', targetAccountId: 'deposit' })],
        savings: [{ id: 'deposit', liquid: false, rate: 1, terms: { mode: 'daily', payoutDay: null, maturityDate: null }, events: [{ date: '2026-03-01', kind: 'rate_change', rate: 10 }], snapshots: [] }],
      })
    );
    expect(result.daily[0]).toEqual({ date: '2026-03-01', liquid: 63500, netWorth: 100000 });
    // 36 500 × 10% / 365 = 10 ₽ a day, credited the next morning.
    expect(result.daily[1].netWorth).toBe(100010);
    expect(result.months[0].transfers).toBe(36500);
  });

  it('counts interest of liquid savings as free money and agrees with the daily series', () => {
    const result = buildForecast(
      input({
        items: [
          item({ kind: 'income', amount: 40000, startDate: '2026-03-05' }),
          item({ kind: 'transfer', amount: 10000, startDate: '2026-03-06', targetAccountId: 'savings' }),
          item({ amount: 15000, startDate: '2026-03-20', spread: true }),
        ],
        savings: [{ id: 'savings', liquid: true, rate: 1, terms: { mode: 'daily', payoutDay: null, maturityDate: null }, events: [{ date: '2026-01-01', kind: 'top_up', amount: 365000 }, { date: '2026-01-01', kind: 'rate_change', rate: 10 }], snapshots: [] }],
      })
    );
    let liquid = result.start.liquid;
    for (const row of result.months) {
      liquid += row.income - row.expenses - row.debtPayments - row.transfers + row.interest;
      expect(row.liquidEnd).toBeCloseTo(liquid, 1);
      liquid = row.liquidEnd;
    }
    expect(result.months[0].transfers).toBe(0);
    expect(result.months[0].interest).toBeGreaterThan(3100);
  });
});

describe('forecast start', () => {
  it('includes savings balances entered today', () => {
    const result = buildForecast(
      input({
        liquidCash: 1000,
        savings: [{ id: 'savings', liquid: true, rate: 1, terms: { mode: 'daily', payoutDay: null, maturityDate: null }, events: [], snapshots: [{ date: '2026-03-01', amount: 50000 }] }],
      })
    );
    expect(result.start).toEqual({ liquid: 51000, netWorth: 51000 });
    expect(result.daily[0].liquid).toBe(51000);
  });
});

describe('plan versus fact', () => {
  it('compares what is left after spending, counting card purchases as spending', () => {
    const rows = planVsFact(
      [item({ kind: 'income', amount: 100000, startDate: '2026-01-05' }), item({ amount: 60000, startDate: '2026-01-10' })],
      [{ from: '2026-01-31', to: '2026-02-28', liquidFrom: 50000, liquidTo: 70000, debtRepaid: 30000, cardPurchases: 15000, balancesEntered: true }],
      new Set()
    );
    // Free money grew by 20 000 while 30 000 of old debt was repaid and 15 000 spent on cards.
    expect(rows).toEqual([{ month: '2026-02', to: '2026-02-28', plan: 40000, fact: 35000, difference: -5000, estimated: false }]);
  });
});
