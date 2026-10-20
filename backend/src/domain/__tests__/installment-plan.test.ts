import { buildInstallmentPlan } from '../plan';
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
    periodStartDate: dueDate,
    principalTotal: principalRemaining,
    principalRemaining,
    dueDate,
    status,
  };
}

describe('buildInstallmentPlan', () => {
  it('groups payments by due month and moves overdue ones to the current month', () => {
    const plan = buildInstallmentPlan(
      [
        bucket('overdue', new Date(2026, 8, 20), 1000, 'overdue'),
        bucket('oct-1', new Date(2026, 9, 5), 3000),
        bucket('oct-2', new Date(2026, 9, 19), 3000),
        bucket('dec', new Date(2026, 11, 1), 2500),
        bucket('paid', new Date(2026, 9, 25), 0, 'closed'),
      ],
      new Date(2026, 9, 10)
    );

    expect(plan.map(({ year, month, amount, bucketIds }) => ({ year, month, amount, bucketIds }))).toEqual([
      { year: 2026, month: 12, amount: 2500, bucketIds: ['dec'] },
      { year: 2026, month: 10, amount: 7000, bucketIds: ['overdue', 'oct-1', 'oct-2'] },
    ]);
  });
});
