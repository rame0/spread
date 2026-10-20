export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export type CardKind = 'credit' | 'installment';
export type InstallmentInterval = 'week' | '2weeks' | 'month';

export interface InstallmentPlan {
  installmentCount: number;
  installmentInterval: InstallmentInterval;
  firstPaymentDate: string;
  installmentFee?: number;
}

export interface Card {
  id: string;
  userId: string;
  name: string;
  kind: CardKind;
  reportDay: number;
  graceModel: 'legacy_months' | 'statement_periods' | 'ozon_anchor';
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
  installmentCount?: number | null;
  installmentInterval?: InstallmentInterval | null;
  firstPaymentDate?: string | null;
  installmentFee?: number;
  /** Present on installment cards. */
  installments?: {
    count: number;
    paid: number;
    nextDueDate: string | null;
    nextDueAmount: number;
    remaining: number;
    overdue: boolean;
  };
  createdAt: string;
}

export interface Deposit {
  id: string;
  cardId: string;
  depositDate: string;
  amount: number;
  createdAt: string;
}

export interface BalanceReconciliation {
  id: string;
  cardId: string;
  reconciliationDate: string;
  actualDebt: number;
  calculatedDebtBefore: number;
  difference: number;
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
    installment?: { number: number; count: number; description: string | null };
  }>;
}

export interface MainDashboardResult {
  dueThisMonth: number;
  overdueAmount: number;
  totalRemaining: number;
  plannedThisMonth: number;
  cards: Array<{
    id: string;
    name: string;
    totalRemaining: number;
    overdueAmount: number;
    nextDueDate: string | null;
    nextDueAmount: number;
  }>;
  payments: Array<{
    cardId: string;
    cardName: string;
    dueDate: string;
    amount: number;
    status: 'overdue' | 'upcoming';
  }>;
}

export type ActivityChartPeriod = '6m' | '12m' | 'all';
export type ActivityChartGranularity = 'day' | 'week' | 'month';

export interface ActivityChartPoint {
  startDate: string;
  endDate: string;
  amount: number;
}

export interface ActivityChartResult {
  period: ActivityChartPeriod;
  granularity: ActivityChartGranularity;
  purchases: ActivityChartPoint[];
  deposits: ActivityChartPoint[];
}

export interface PeriodPlanRow {
  year: number;
  month: number;
  dueDate: string;
  amount: number;
  bucketIds: string[];
}

export interface CardExportPayload {
  version: 1 | 2 | 3;
  exportedAt: string;
  card: {
    name: string;
    kind?: CardKind;
    reportDay: number;
    graceModel: 'legacy_months' | 'statement_periods' | 'ozon_anchor';
    gracePeriods: number;
    graceDueDay: number;
    graceStatementPeriods: number;
    paymentDueOffsetDays: number;
  };
  purchases: Array<{
    purchaseDate: string;
    amount: number;
    description?: string;
    plan?: InstallmentPlan;
  }>;
  deposits: Array<{
    depositDate: string;
    amount: number;
  }>;
  reconciliations?: Array<{ reconciliationDate: string; actualDebt: number }>;
  events?: Array<
    | { type: 'purchase'; date: string; amount: number; description?: string; plan?: InstallmentPlan }
    | { type: 'deposit'; date: string; amount: number }
    | { type: 'reconciliation'; date: string; actualDebt: number }
  >;
}

export interface CardImportResult {
  importedPurchases: number;
  importedDeposits: number;
  importedReconciliations: number;
}

export interface StatementOperationPreview {
  fingerprint: string;
  sourceId?: string;
  operationDate: string;
  operationTime?: string;
  kind: 'purchase' | 'deposit';
  amount: number;
  description: string;
  duplicate: boolean;
  duplicateReason?: 'already_imported' | 'matching_event';
}

export interface StatementPreview {
  fileName: string;
  fileHash: string;
  bank: 'sber' | 'ozon';
  periodStart: string;
  periodEnd: string;
  actualDebt: number;
  reconciliationAllowed: boolean;
  reconciliationAlreadyImported: boolean;
  lastEventDate: string | null;
  operations: StatementOperationPreview[];
}

export interface StatementImportResult {
  importedPurchases: number;
  importedDeposits: number;
  skippedDuplicates: number;
  reconciliationCreated: boolean;
}

export interface StatementImportHistoryItem {
  id: string;
  bank: 'sber' | 'ozon';
  fileName: string;
  periodStart: string | null;
  periodEnd: string | null;
  actualDebt: number | null;
  reconciliationId: string | null;
  createdAt: string;
}
