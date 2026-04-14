export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface Card {
  id: string;
  userId: string;
  name: string;
  reportDay: number;
  graceModel: 'legacy_months' | 'statement_periods';
  gracePeriods: number;
  graceDueDay: number;
  graceStatementPeriods: number;
  paymentDueOffsetDays: number;
  createdAt: string;
}

export interface Purchase {
  id: string;
  cardId: string;
  purchaseDate: string;
  amount: number;
  description?: string;
  createdAt: string;
}

export interface Deposit {
  id: string;
  cardId: string;
  depositDate: string;
  amount: number;
  createdAt: string;
}

export interface GraceBucket {
  id: string;
  cardId: string;
  statementPeriodStart: { year: number; month: number };
  principalTotal: number;
  principalRemaining: number;
  dueDate: string;
  status: 'active' | 'closed' | 'overdue';
}

export interface DashboardResult {
  /** Сумма к внесению в текущем месяце (чтобы не выйти из грейса) */
  currentMonthAmount: number;
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

export interface PeriodPlanRow {
  year: number;
  month: number;
  dueDate: string;
  amount: number;
  bucketIds: string[];
}

export interface CardExportPayload {
  version: 1;
  exportedAt: string;
  card: {
    name: string;
    reportDay: number;
    graceModel: 'legacy_months' | 'statement_periods';
    gracePeriods: number;
    graceDueDay: number;
    graceStatementPeriods: number;
    paymentDueOffsetDays: number;
  };
  purchases: Array<{
    purchaseDate: string;
    amount: number;
    description?: string;
  }>;
  deposits: Array<{
    depositDate: string;
    amount: number;
  }>;
}

export interface CardImportResult {
  importedPurchases: number;
  importedDeposits: number;
}
