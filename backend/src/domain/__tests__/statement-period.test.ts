import { getStatementPeriodStart } from '../statement-period';

describe('getStatementPeriodStart', () => {
  const reportDay = 10;

  it('day 9 → previous month (January for Feb 9)', () => {
    const date = new Date(2025, 1, 9); // 9 Feb
    expect(getStatementPeriodStart(date, reportDay)).toEqual({
      year: 2025,
      month: 1,
    });
  });

  it('day 10 → previous month (January for Feb 10)', () => {
    const date = new Date(2025, 1, 10); // 10 Feb
    expect(getStatementPeriodStart(date, reportDay)).toEqual({
      year: 2025,
      month: 1,
    });
  });

  it('day 11 → current month (February for Feb 11)', () => {
    const date = new Date(2025, 1, 11); // 11 Feb
    expect(getStatementPeriodStart(date, reportDay)).toEqual({
      year: 2025,
      month: 2,
    });
  });

  it('Jan 1 with reportDay 10 → December previous year', () => {
    const date = new Date(2025, 0, 1);
    expect(getStatementPeriodStart(date, reportDay)).toEqual({
      year: 2024,
      month: 12,
    });
  });

  it('Jan 10 → December previous year', () => {
    const date = new Date(2025, 0, 10);
    expect(getStatementPeriodStart(date, reportDay)).toEqual({
      year: 2024,
      month: 12,
    });
  });

  it('Jan 11 → January current year', () => {
    const date = new Date(2025, 0, 11);
    expect(getStatementPeriodStart(date, reportDay)).toEqual({
      year: 2025,
      month: 1,
    });
  });

  it('leap year Feb 29 with reportDay 10 → February (29 > 10)', () => {
    const date = new Date(2024, 1, 29);
    expect(getStatementPeriodStart(date, reportDay)).toEqual({
      year: 2024,
      month: 2,
    });
  });

  it('leap year Feb 10 with reportDay 10 → January', () => {
    const date = new Date(2024, 1, 10);
    expect(getStatementPeriodStart(date, reportDay)).toEqual({
      year: 2024,
      month: 1,
    });
  });
});
