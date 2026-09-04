import { allocateDeposit } from '../deposit-allocation';
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
