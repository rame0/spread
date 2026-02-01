/**
 * V2 domain types — grace period model.
 */

/** Start of statement period: year and month (month 1–12). */
export interface StatementPeriodStart {
  year: number;
  month: number;
}

/** Grace bucket status. */
export type GraceBucketStatus = 'active' | 'closed' | 'overdue';

/** Grace bucket (conceptual): one "pack" of grace debt per statement period. */
export interface GraceBucket {
  id: string;
  cardId: string;
  statementPeriodStart: StatementPeriodStart;
  principalTotal: number;
  principalRemaining: number;
  dueDate: Date;
  status: GraceBucketStatus;
}

/** Allocation of a deposit to a bucket. */
export interface Allocation {
  depositId: string;
  graceBucketId: string;
  amount: number;
}

/** Card settings (report day, grace periods, due day). */
export interface CardSettings {
  reportDay: number;
  gracePeriods: number;
  graceDueDay: number;
}
