import {
  RULESETS,
  TAX_YEARS,
  cofinancingRatio,
  defaultUnlockDate,
  findRuleset,
  incomeTax,
  rulesetsFor,
  taxYearRules,
} from '../tax-benefit-rules';

describe('tax benefit rules', () => {
  // Accounts keep the ruleset they were opened under: a published entry must never change.
  // A new law is a new ruleset or tax year, never an edit of this snapshot.
  it('keeps published rulesets and tax years as they are', () => {
    expect(RULESETS).toMatchSnapshot();
    expect(TAX_YEARS).toMatchSnapshot();
  });

  it('has unique ids and ordered tax years', () => {
    expect(new Set(RULESETS.map((ruleset) => ruleset.id)).size).toBe(RULESETS.length);
    const years = TAX_YEARS.map((rules) => rules.fromYear);
    expect([...years].sort((a, b) => a - b)).toEqual(years);
  });

  it('offers the rulesets in force on the opening date', () => {
    expect(rulesetsFor('iis', '2014-12-31')).toEqual([]);
    expect(rulesetsFor('iis', '2023-12-31').map((ruleset) => ruleset.id)).toEqual(['iis-a-2015', 'iis-b-2015']);
    expect(rulesetsFor('iis', '2024-01-01').map((ruleset) => ruleset.id)).toEqual(['iis3-2024']);
    expect(rulesetsFor('pds', '2023-12-31')).toEqual([]);
    expect(rulesetsFor('pds', '2026-11-03').map((ruleset) => ruleset.id)).toEqual(['pds-2024']);
  });

  it('locks ИИС-3 longer the later it is opened', () => {
    const iis3 = findRuleset('iis3-2024')!;
    expect(defaultUnlockDate(iis3, '2026-12-31')).toBe('2031-12-31');
    expect(defaultUnlockDate(iis3, '2027-01-10')).toBe('2033-01-10');
    expect(defaultUnlockDate(iis3, '2035-03-01')).toBe('2045-03-01');
    expect(defaultUnlockDate(findRuleset('iis-a-2015')!, '2020-02-29')).toBe('2023-02-28');
    expect(defaultUnlockDate(findRuleset('pds-2024')!, '2026-11-01')).toBe('2041-11-01');
  });

  it('takes the tax year rules in force', () => {
    expect(taxYearRules(2023)).toBeNull();
    expect(taxYearRules(2024)!.fromYear).toBe(2024);
    expect(taxYearRules(2030)!.fromYear).toBe(2025);
  });

  it('taxes income by the progressive scale', () => {
    const rules = taxYearRules(2026)!;
    expect(incomeTax(rules, 1_000_000)).toBe(130_000);
    expect(incomeTax(rules, 3_000_000)).toBe(312_000 + 90_000);
    expect(incomeTax(taxYearRules(2024)!, 3_000_000)).toBe(390_000);
  });

  it('picks the co-financing ratio by average monthly income', () => {
    const rules = taxYearRules(2026)!;
    expect(cofinancingRatio(rules, 80_000 * 12)).toBe(1);
    expect(cofinancingRatio(rules, 80_000.01 * 12)).toBe(0.5);
    expect(cofinancingRatio(rules, 150_000 * 12)).toBe(0.5);
    expect(cofinancingRatio(rules, 150_000.01 * 12)).toBe(0.25);
  });
});
