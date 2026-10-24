import { allocateDeposit, replayRepayments } from '../deposit-allocation';
import type { GraceBucket } from '../types';

function bucket(
  id: string,
  dueDate: Date,
  principalRemaining: number,
  status: GraceBucket['status'] = 'active'
): GraceBucket {
  return {
    id,
    cardId: 'c1',
    statementPeriodStart: { year: dueDate.getFullYear(), month: dueDate.getMonth() + 1 },
    periodStartDate: new Date(dueDate.getFullYear(), dueDate.getMonth(), 1),
    principalTotal: principalRemaining,
    principalRemaining,
    dueDate,
    status,
  };
}

describe('allocateDeposit', () => {
  it('allocates to earliest due bucket first', () => {
    const buckets: GraceBucket[] = [
      bucket('b2', new Date(2025, 5, 10), 500),  // June
      bucket('b1', new Date(2025, 4, 10), 300),  // May
    ];
    const allocations = allocateDeposit('d1', 400, buckets);
    expect(allocations).toHaveLength(2);
    expect(allocations[0]).toEqual({ depositId: 'd1', graceBucketId: 'b1', amount: 300 });
    expect(allocations[1]).toEqual({ depositId: 'd1', graceBucketId: 'b2', amount: 100 });
  });

  it('skips closed and zero-remaining buckets', () => {
    const buckets: GraceBucket[] = [
      { ...bucket('b1', new Date(2025, 4, 10), 100), status: 'closed' },
      bucket('b2', new Date(2025, 5, 10), 200),
    ];
    const allocations = allocateDeposit('d1', 500, buckets);
    expect(allocations).toEqual([{ depositId: 'd1', graceBucketId: 'b2', amount: 200 }]);
  });

  it('does not allocate excess (deposit larger than total remaining)', () => {
    const buckets = [bucket('b1', new Date(2025, 4, 10), 100)];
    const allocations = allocateDeposit('d1', 500, buckets);
    expect(allocations).toEqual([{ depositId: 'd1', graceBucketId: 'b1', amount: 100 }]);
  });

  it('returns empty when no active buckets with remaining', () => {
    const buckets: GraceBucket[] = [
      { ...bucket('b1', new Date(2025, 4, 10), 0), status: 'active' },
    ];
    expect(allocateDeposit('d1', 100, buckets)).toEqual([]);
  });

  it('also allocates to overdue buckets', () => {
    const overdue = bucket('overdue', new Date('2024-01-01'), 50, 'overdue');
    expect(allocateDeposit('d1', 50, [overdue])).toEqual([
      { depositId: 'd1', graceBucketId: 'overdue', amount: 50 },
    ]);
  });
});

describe('replayRepayments', () => {
  const period = (id: string, start: string, due: string, debt: number) => ({ id, periodStartDate: start, dueDate: due, debt });

  it('pays a back-dated purchase from later payments before later periods', () => {
    // February got a purchase after the July payment had closed March.
    const { remaining } = replayRepayments(
      [period('feb', '2026-02-01', '2026-06-10', 1200), period('mar', '2026-03-01', '2026-07-10', 1000)],
      [{ id: 'jul', date: '2026-07-01', amount: 1500 }]
    );
    expect(remaining.get('feb')).toBe(0);
    expect(remaining.get('mar')).toBe(700);
  });

  it('does not pay debt that appeared after the payment until it is the only debt left', () => {
    const { allocations } = replayRepayments(
      [period('jan', '2026-01-01', '2026-05-10', 100), period('mar', '2026-03-01', '2026-07-10', 500)],
      [{ id: 'p1', date: '2026-02-01', amount: 300 }, { id: 'p2', date: '2026-03-15', amount: 300 }]
    );
    expect(allocations).toEqual([
      { repaymentId: 'p1', graceBucketId: 'jan', amount: 100 },
      { repaymentId: 'p1', graceBucketId: 'mar', amount: 200 },
      { repaymentId: 'p2', graceBucketId: 'mar', amount: 300 },
    ]);
  });

  it('keeps total debt when repayments fit', () => {
    const { remaining } = replayRepayments(
      [period('a', '2026-01-01', '2026-05-10', 1000.1), period('b', '2026-02-01', '2026-06-10', 2000.2)],
      [{ id: 'x', date: '2026-03-01', amount: 0.3 }, { id: 'y', date: '2026-01-15', amount: 1500 }]
    );
    expect([...remaining.values()].reduce((sum, value) => sum + value, 0)).toBeCloseTo(1500, 2);
    expect(remaining.get('a')).toBe(0);
  });
});
