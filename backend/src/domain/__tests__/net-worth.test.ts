import { balanceOn, cardDebtOn, historyDates, valueAssets, type NetWorthAccount } from '../net-worth';

const account = (id: string, overrides: Partial<NetWorthAccount> = {}): NetWorthAccount => ({
  id,
  name: id,
  kind: 'debit',
  currency: 'RUB',
  isLiquid: true,
  archivedAt: null,
  ...overrides,
});

const rates: Record<string, number> = { USD: 80, KZT: 0.16 };
const rate = (currency: string) => rates[currency] ?? null;

describe('net worth', () => {
  it('takes the last balance entered on or before the date', () => {
    const snapshots = [
      { date: '2026-09-01', amount: 100 },
      { date: '2026-10-01', amount: 200 },
    ];
    expect(balanceOn(snapshots, '2026-08-31')).toBeNull();
    expect(balanceOn(snapshots, '2026-09-30')?.amount).toBe(100);
    expect(balanceOn(snapshots, '2026-10-01')?.amount).toBe(200);
  });

  it('values foreign currencies in roubles and splits out liquid money', () => {
    const result = valueAssets(
      [account('rub'), account('usd', { currency: 'USD', kind: 'brokerage', isLiquid: false }), account('kzt', { currency: 'KZT' })],
      new Map([
        ['rub', [{ date: '2026-10-01', amount: 1000.5 }]],
        ['usd', [{ date: '2026-10-01', amount: 10 }]],
        ['kzt', [{ date: '2026-10-01', amount: 10000 }]],
      ]),
      rate,
      '2026-10-21'
    );
    expect(result.lines.map((line) => line.rubAmount)).toEqual([1000.5, 800, 1600]);
    expect(result.total).toBe(3400.5);
    expect(result.liquidTotal).toBe(2600.5);
  });

  it('totals property separately', () => {
    const result = valueAssets(
      [account('rub'), account('home', { kind: 'property', isLiquid: false })],
      new Map([
        ['rub', [{ date: '2026-10-01', amount: 1000 }]],
        ['home', [{ date: '2026-10-01', amount: 9000000 }]],
      ]),
      rate,
      '2026-10-21'
    );
    expect(result.total).toBe(9001000);
    expect(result.propertyTotal).toBe(9000000);
    expect(result.liquidTotal).toBe(1000);
  });

  it('leaves out accounts without a rate and reports the currency', () => {
    const result = valueAssets(
      [account('rub'), account('gel', { currency: 'GEL' })],
      new Map([
        ['rub', [{ date: '2026-10-01', amount: 500 }]],
        ['gel', [{ date: '2026-10-01', amount: 100 }]],
      ]),
      rate,
      '2026-10-21'
    );
    expect(result.total).toBe(500);
    expect(result.missingRates).toEqual(['GEL']);
    expect(result.lines[1].rubAmount).toBeNull();
  });

  it('counts an archived account only before its archive date', () => {
    const accounts = [account('closed', { archivedAt: '2026-10-01' })];
    const snapshots = new Map([['closed', [{ date: '2026-09-01', amount: 300 }]]]);
    expect(valueAssets(accounts, snapshots, rate, '2026-09-30').total).toBe(300);
    expect(valueAssets(accounts, snapshots, rate, '2026-10-01').lines).toHaveLength(0);
  });

  it('marks balances older than 30 days as stale', () => {
    const snapshots = new Map([['rub', [{ date: '2026-09-01', amount: 1 }]]]);
    expect(valueAssets([account('rub')], snapshots, rate, '2026-10-01').lines[0].stale).toBe(false);
    expect(valueAssets([account('rub')], snapshots, rate, '2026-10-02').lines[0].stale).toBe(true);
  });

  it('never marks a calculated balance as stale', () => {
    const snapshots = new Map([['savings', [{ date: '2026-01-01', amount: 1 }]]]);
    expect(valueAssets([account('savings', { computed: true })], snapshots, rate, '2026-10-01').lines[0]).toMatchObject({ stale: false, computed: true });
  });

  it('builds month ends followed by the valuation date', () => {
    expect(historyDates('2026-03-15', 3)).toEqual(['2025-12-31', '2026-01-31', '2026-02-28', '2026-03-15']);
    expect(historyDates('2026-03-15', 0)).toEqual(['2026-03-15']);
  });

  it('rebuilds card debt from movements without going negative', () => {
    const movements = [
      { date: '2026-09-01', amount: 1000 },
      { date: '2026-09-10', amount: -400 },
      { date: '2026-10-05', amount: -800 },
    ];
    expect(cardDebtOn(movements, '2026-08-31')).toBe(0);
    expect(cardDebtOn(movements, '2026-09-30')).toBe(600);
    expect(cardDebtOn(movements, '2026-10-31')).toBe(0);
  });
});
