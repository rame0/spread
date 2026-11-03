import { expectedInflows, summarizeYear, type BenefitAccount, type BenefitEvent, type YearInput } from '../tax-benefits';

const pds = (id: string, openedAt = '2025-03-01'): BenefitAccount => ({ id, kind: 'pds', ruleset: 'pds-2024', openedAt, archivedAt: null });
const iis = (id: string, ruleset: string | null, openedAt = '2024-02-01'): BenefitAccount => ({ id, kind: 'iis', ruleset, openedAt, archivedAt: null });
const contribution = (accountId: string, date: string, amount: number): BenefitEvent => ({ accountId, kind: 'contribution', date, amount });

const summarize = (input: Partial<YearInput>) =>
  summarizeYear({ year: 2026, accounts: [], events: [], annualIncome: null, otherDeductible: 0, ...input });

describe('tax benefits', () => {
  it('co-finances ПДС by income and caps it across contracts', () => {
    const accounts = [pds('a'), pds('b')];
    const events = [contribution('a', '2026-02-01', 50_000), contribution('b', '2026-06-01', 30_000)];
    expect(summarize({ accounts, events, annualIncome: 900_000 }).cofinancing).toMatchObject({
      contributions: 80_000,
      ratio: 1,
      status: 'ok',
      expected: 36_000,
      toMax: 0,
    });
    expect(summarize({ accounts, events, annualIncome: 1_200_000 }).cofinancing).toMatchObject({ ratio: 0.5, expected: 36_000 });
    expect(summarize({ accounts, events, annualIncome: 2_400_000 }).cofinancing).toMatchObject({ ratio: 0.25, expected: 20_000, toMax: 64_000 });
  });

  it('needs the minimum contribution and counts planned ones', () => {
    const accounts = [pds('a')];
    const events = [contribution('a', '2026-02-01', 1_500)];
    expect(summarize({ accounts, events }).cofinancing).toMatchObject({ status: 'below_minimum', expected: 0, toMinimum: 500, toMax: 34_500 });
    const planned = new Map([['a', 1_000]]);
    expect(summarize({ accounts, events, planned }).cofinancing).toMatchObject({ contributions: 2_500, status: 'ok', expected: 2_500 });
  });

  it('starts the co-financing window with the first contribution and ends it after 10 years', () => {
    const accounts = [pds('a', '2024-01-10')];
    const events = [contribution('a', '2024-12-01', 10_000), contribution('a', '2034-01-15', 10_000)];
    expect(summarize({ accounts, events, year: 2033 }).cofinancing).toMatchObject({ firstYear: 2024, lastYear: 2033, status: 'below_minimum' });
    expect(summarize({ accounts, events, year: 2034 }).cofinancing).toMatchObject({ status: 'window_over', expected: 0, toMax: 0 });
    // Nothing contributed yet: this year would be the first one.
    expect(summarize({ accounts: [pds('b')], year: 2026 }).cofinancing).toMatchObject({ firstYear: 2026, lastYear: 2035, toMinimum: 2_000 });
  });

  it('shares the deduction limit between ПДС, ИИС-3 and other contributions', () => {
    const accounts = [pds('p'), iis('i', 'iis3-2024')];
    const events = [contribution('p', '2026-03-01', 100_000), contribution('i', '2026-04-01', 350_000)];
    const { deduction } = summarize({ accounts, events, annualIncome: 3_000_000, otherDeductible: 20_000 });
    expect(deduction).toMatchObject({ contributions: 450_000, other: 20_000, base: 400_000, toLimit: 0 });
    // 3 mln falls in the 15% bracket: 400 000 less taxable income returns 15% of it.
    expect(deduction.refund).toBe(60_000);
  });

  it('refunds at the lowest rate without income and splits brackets', () => {
    const accounts = [iis('i', 'iis3-2024')];
    const events = [contribution('i', '2026-04-01', 200_000)];
    expect(summarize({ accounts, events }).deduction).toMatchObject({ base: 200_000, refund: 26_000, toLimit: 200_000 });
    expect(summarize({ accounts, events }).incomeAssumed).toBe(true);
    // 100 000 above 2.4 mln at 15% and 100 000 below it at 13%.
    expect(summarize({ accounts, events, annualIncome: 2_500_000 }).deduction.refund).toBe(28_000);
  });

  it('gives no deduction for ИИС type B and warns about a second ИИС next to an old one', () => {
    const accounts = [iis('b', 'iis-b-2015', '2021-05-01'), iis('n', 'iis3-2024'), iis('x', null)];
    const events = [contribution('b', '2026-01-10', 1_100_000), contribution('n', '2026-01-10', 10_000)];
    const summary = summarize({ accounts, events });
    expect(summary.deduction.contributions).toBe(10_000);
    expect(summary.accounts.find((row) => row.accountId === 'b')!.warnings).toEqual(['single_iis', 'over_contribution_cap']);
    expect(summary.accounts.find((row) => row.accountId === 'x')!.warnings).toEqual(['no_ruleset']);
  });

  it('estimates nothing before the rules are known', () => {
    const summary = summarize({ year: 2023, accounts: [iis('a', 'iis-a-2015', '2020-01-01')], events: [contribution('a', '2023-01-10', 400_000)] });
    expect(summary).toMatchObject({ rulesKnown: false, cofinancing: null, deduction: { refund: 0 } });
  });

  it('leaves out inflows received or past their usual date', () => {
    const summaries = [2025, 2026].map((year) =>
      summarize({ year, accounts: [pds('a')], events: [contribution('a', `${year}-03-01`, 36_000)] })
    );
    expect(expectedInflows(summaries, { cofinancing: new Set(), refund: new Set([2025]) }, '2026-06-01')).toEqual([
      { year: 2025, kind: 'cofinancing', date: '2026-07-15', amount: 36_000, liquid: false },
      { year: 2026, kind: 'cofinancing', date: '2027-07-15', amount: 36_000, liquid: false },
      { year: 2026, kind: 'tax_refund', date: '2027-05-15', amount: 4_680, liquid: true },
    ]);
  });
});
