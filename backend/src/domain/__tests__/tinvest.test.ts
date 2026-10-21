import { toNumber, toPortfolioStructure } from '../tinvest';

describe('T-Bank Invest mapping', () => {
  it('combines units and nano, including negative values', () => {
    expect(toNumber({ units: '33161', nano: 790000000 })).toBeCloseTo(33161.79, 9);
    expect(toNumber({ units: '-19', nano: -910000000 })).toBeCloseTo(-19.91, 9);
    expect(toNumber({ nano: 500000000 })).toBe(0.5);
    expect(toNumber(undefined)).toBeNull();
  });

  it('builds the portfolio structure without empty parts', () => {
    const structure = toPortfolioStructure({
      totalAmountShares: { currency: 'rub', units: '0', nano: 0 },
      totalAmountEtf: { currency: 'rub', units: '33101', nano: 280000000 },
      totalAmountCurrencies: { currency: 'rub', units: '60', nano: 510000000 },
      totalAmountPortfolio: { currency: 'rub', units: '33161', nano: 790000000 },
      expectedYield: { units: '-19', nano: -910000000 },
      dailyYield: { currency: 'rub', units: '0', nano: 0 },
    });
    expect(structure).toEqual({
      total: 33161.79,
      parts: [
        { part: 'etf', amount: 33101.28 },
        { part: 'currencies', amount: 60.51 },
      ],
      expectedYieldPercent: -19.91,
      dailyYield: 0,
    });
  });
});
