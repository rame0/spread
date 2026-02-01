import { findCardById } from '../repositories/cardRepository';
import { findBucketsByCardId } from '../repositories/graceBucketRepository';
import type { GraceBucketRow } from '../repositories/graceBucketRepository';
import type { GraceBucket } from '../domain/types';

function rowToBucket(row: GraceBucketRow, asOf: Date): GraceBucket {
  const dueDate = new Date(row.dueDate);
  let status = row.status as GraceBucket['status'];
  if (status === 'active' && row.principalRemaining > 0 && dueDate < asOf) {
    status = 'overdue';
  }
  if (row.principalRemaining <= 0) status = 'closed';
  return {
    id: row.id,
    cardId: row.cardId,
    statementPeriodStart: { year: row.periodYear, month: row.periodMonth },
    principalTotal: row.principalTotal,
    principalRemaining: row.principalRemaining,
    dueDate,
    status,
  };
}

export interface DashboardResult {
  nextDueDate: string | null;
  totalRemaining: number;
  recommendedDeposit: number;
  buckets: Array<{
    id: string;
    statementPeriodStart: { year: number; month: number };
    principalRemaining: number;
    dueDate: string;
    status: string;
  }>;
}

export async function getDashboard(
  cardId: string,
  asOfStr?: string,
  userId?: string
): Promise<DashboardResult | null> {
  const card = await findCardById(cardId);
  if (!card) return null;
  if (userId != null && card.userId !== userId) return null;
  const asOf = asOfStr ? new Date(asOfStr) : new Date();
  const rows = await findBucketsByCardId(cardId);
  const buckets = rows.map((r) => rowToBucket(r, asOf));
  const active = buckets.filter(
    (b) => (b.status === 'active' || b.status === 'overdue') && b.principalRemaining > 0
  );
  const sorted = [...active].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const nextDue = sorted[0] ?? null;
  const totalRemaining = active.reduce((s, b) => s + b.principalRemaining, 0);
  const recommendedDeposit = nextDue ? nextDue.principalRemaining : 0;
  return {
    nextDueDate: nextDue ? nextDue.dueDate.toISOString().slice(0, 10) : null,
    totalRemaining,
    recommendedDeposit,
    buckets: buckets.map((b) => ({
      id: b.id,
      statementPeriodStart: b.statementPeriodStart,
      principalRemaining: b.principalRemaining,
      dueDate: b.dueDate.toISOString().slice(0, 10),
      status: b.status,
    })),
  };
}
