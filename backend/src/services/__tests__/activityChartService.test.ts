import { buildActivityChart } from '../activityChartService';

describe('activity chart aggregation', () => {
  const asOf = new Date('2026-09-05T12:00:00.000Z');

  it('groups six months by day and fills gaps with zeroes', () => {
    const chart = buildActivityChart(
      '6m',
      [
        { date: '2026-04-05', amount: 10.1 },
        { date: '2026-04-05', amount: 20.2 },
        { date: '2026-09-06', amount: 999 },
      ],
      [{ date: '2026-09-05', amount: 15 }],
      asOf
    );

    expect(chart.granularity).toBe('day');
    expect(chart.purchases).toHaveLength(158);
    expect(chart.purchases[0]).toEqual({ startDate: '2026-04-01', endDate: '2026-04-01', amount: 0 });
    expect(chart.purchases[4]?.amount).toBe(30.3);
    expect(chart.purchases[chart.purchases.length - 1]).toEqual({ startDate: '2026-09-05', endDate: '2026-09-05', amount: 0 });
    expect(chart.deposits[chart.deposits.length - 1]?.amount).toBe(15);
  });

  it('groups twelve months by bounded Monday-to-Sunday weeks', () => {
    const chart = buildActivityChart(
      '12m',
      [{ date: '2025-10-01', amount: 100 }, { date: '2025-10-05', amount: 50 }],
      [],
      asOf
    );

    expect(chart.granularity).toBe('week');
    expect(chart.purchases[0]).toEqual({ startDate: '2025-10-01', endDate: '2025-10-05', amount: 150 });
    expect(chart.purchases[chart.purchases.length - 1]?.endDate).toBe('2026-09-05');
  });

  it('groups all history by month and returns no points without operations', () => {
    const chart = buildActivityChart(
      'all',
      [{ date: '2026-02-28', amount: 100 }],
      [{ date: '2026-04-01', amount: 25.25 }],
      asOf
    );

    expect(chart.granularity).toBe('month');
    expect(chart.purchases.slice(0, 3)).toEqual([
      { startDate: '2026-02-01', endDate: '2026-02-28', amount: 100 },
      { startDate: '2026-03-01', endDate: '2026-03-31', amount: 0 },
      { startDate: '2026-04-01', endDate: '2026-04-30', amount: 0 },
    ]);
    expect(buildActivityChart('all', [], [], asOf).purchases).toEqual([]);
  });
});
