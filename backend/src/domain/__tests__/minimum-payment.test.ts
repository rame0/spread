import { buildLateSchedule, minimumPayment, statementCalendar } from '../minimum-payment';
import type { CardSettings } from '../types';

const sber: CardSettings = {
  graceModel: 'legacy_months',
  reportDay: 10,
  gracePeriods: 4,
  graceDueDay: 10,
  graceStatementPeriods: 4,
  paymentDueOffsetDays: 0,
};

const ozon: CardSettings = {
  graceModel: 'ozon_anchor',
  reportDay: 14,
  gracePeriods: 2,
  graceDueDay: 10,
  graceStatementPeriods: 2,
  paymentDueOffsetDays: 16,
};

describe('minimum payment', () => {
  it('takes a percent of the debt, not less than the minimum and not more than the debt', () => {
    const terms = { percent: 4, minimum: 400 };
    expect(minimumPayment(50_000, terms)).toBe(2000);
    expect(minimumPayment(5_000, terms)).toBe(400);
    expect(minimumPayment(250, terms)).toBe(250);
    expect(minimumPayment(0, terms)).toBe(0);
  });
});

describe('statement calendar', () => {
  it('closes Sber statements on the report day and expects the minimum by the next one', () => {
    const calendar = statementCalendar(sber);
    expect(calendar.closeOnOrBefore('2026-10-22')).toBe('2026-10-10');
    expect(calendar.closeOnOrBefore('2026-10-09')).toBe('2026-09-10');
    expect(calendar.nextClose('2026-12-10')).toBe('2027-01-10');
    expect(calendar.minimumDue('2026-10-10')).toBe('2026-11-10');
  });

  it('runs Ozon periods monthly from the bucket start with 16 days to pay', () => {
    const calendar = statementCalendar(ozon, '2026-05-12');
    expect(calendar.closeOnOrBefore('2026-06-11')).toBe('2026-06-11');
    expect(calendar.closeOnOrBefore('2026-06-10')).toBe('2026-05-11');
    expect(calendar.nextClose('2026-06-11')).toBe('2026-07-11');
    // The bucket opened on 12 May is due on 27 July, together with the second minimum.
    expect(calendar.minimumDue('2026-07-11')).toBe('2026-07-27');
  });

  it('clamps period starts to short months', () => {
    const calendar = statementCalendar(ozon, '2026-01-31');
    expect(calendar.nextClose('2026-02-27')).toBe('2026-03-30');
  });
});

describe('late schedule', () => {
  const terms = { percent: 10, minimum: 150 };

  it('pays only the minimum until a bucket is due, then closes it in full', () => {
    const rows = buildLateSchedule({
      today: '2026-10-22',
      terms,
      calendar: statementCalendar(sber),
      buckets: [{ id: 'sep', dueDate: '2027-01-10', remaining: 10_000 }],
      purchasedSinceStatement: 0,
      paidSinceStatement: 0,
    });

    expect(rows.map(({ date, amount, minimum, closing }) => [date, amount, minimum, closing])).toEqual([
      ['2026-11-10', 1000, 1000, 0],
      ['2026-12-10', 900, 900, 0],
      ['2027-01-10', 8100, 810, 8100],
    ]);
    expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(10_000);
  });

  it('counts what was paid since the statement and leaves out newer purchases', () => {
    const rows = buildLateSchedule({
      today: '2026-10-22',
      terms,
      calendar: statementCalendar(sber),
      buckets: [
        { id: 'sep', dueDate: '2027-01-10', remaining: 9_700 },
        { id: 'oct', dueDate: '2027-02-10', remaining: 2_000 },
      ],
      // The statement on 10 October saw 10 000; 300 was paid and 2 000 spent since.
      purchasedSinceStatement: 2_000,
      paidSinceStatement: 300,
    });

    expect(rows[0]).toMatchObject({ date: '2026-11-10', amount: 700, minimum: 700, closing: 0, bucketIds: ['sep'] });
  });

  it('skips the open minimum when it is already paid', () => {
    const rows = buildLateSchedule({
      today: '2026-10-22',
      terms,
      calendar: statementCalendar(sber),
      buckets: [{ id: 'sep', dueDate: '2027-01-10', remaining: 9_000 }],
      purchasedSinceStatement: 0,
      paidSinceStatement: 1_000,
    });

    expect(rows[0].date).toBe('2026-12-10');
  });

  it('pays overdue buckets today', () => {
    const rows = buildLateSchedule({
      today: '2026-10-22',
      terms,
      calendar: statementCalendar(sber),
      buckets: [
        { id: 'old', dueDate: '2026-10-10', remaining: 500 },
        { id: 'sep', dueDate: '2027-01-10', remaining: 1_000 },
      ],
      purchasedSinceStatement: 0,
      paidSinceStatement: 0,
    });

    expect(rows[0]).toMatchObject({ date: '2026-10-22', amount: 500, closing: 500, overdue: true, bucketIds: ['old'] });
    expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(1_500);
  });

  it('follows Ozon: a minimum after the first period and the bucket with the second', () => {
    const rows = buildLateSchedule({
      today: '2026-05-20',
      terms: { percent: 4, minimum: 400 },
      calendar: statementCalendar(ozon, '2026-05-12'),
      buckets: [{ id: 'may', dueDate: '2026-07-27', remaining: 30_000 }],
      purchasedSinceStatement: 30_000,
      paidSinceStatement: 0,
    });

    expect(rows.map(({ date, amount, closing }) => [date, amount, closing])).toEqual([
      ['2026-06-27', 1200, 0],
      ['2026-07-27', 28_800, 28_800],
    ]);
  });
});
