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
    kind: DebtKind;
    totalRemaining: number;
    overdueAmount: number;
    nextDueDate: string | null;
    nextDueAmount: number;
  }>;
  payments: Array<{
    /** Card or mortgage id, depending on `kind`. */
    cardId: string;
    cardName: string;
    kind: DebtKind;
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

export type DebtKind = CardKind | 'mortgage';
export type PrepaymentMode = 'reduce_term' | 'reduce_payment';
export type MortgageEventKind = 'payment' | 'prepayment' | 'rate_change' | 'reconciliation';

export interface Mortgage {
  id: string;
  userId: string;
  name: string;
  principal: number;
  issueDate: string;
  annualRate: number;
  termMonths: number;
  paymentDay: number;
  firstPaymentInterestOnly: boolean;
  createdAt: string;
}

export type MortgageInput = Pick<
  Mortgage,
  'name' | 'principal' | 'issueDate' | 'annualRate' | 'termMonths' | 'paymentDay' | 'firstPaymentInterestOnly'
>;

export interface MortgageEvent {
  id: string;
  mortgageId: string;
  kind: MortgageEventKind;
  eventDate: string;
  amount: number | null;
  prepaymentMode: PrepaymentMode | null;
  newRate: number | null;
  actualBalance: number | null;
  note: string | null;
  createdAt: string;
}

export type MortgageEventInput =
  | { kind: 'payment'; eventDate: string; amount: number }
  | { kind: 'prepayment'; eventDate: string; amount: number; prepaymentMode: PrepaymentMode }
  | { kind: 'rate_change'; eventDate: string; newRate: number }
  | { kind: 'reconciliation'; eventDate: string; actualBalance: number };

export interface MortgageScheduleRow {
  date: string;
  kind: 'scheduled' | 'prepayment' | 'rate_change' | 'reconciliation';
  payment: number;
  expected: number;
  interest: number;
  principal: number;
  balanceAfter: number;
  status: 'paid' | 'overdue' | 'planned';
  number?: number;
  eventId?: string;
  mode?: PrepaymentMode;
  rate?: number;
  difference?: number;
}

export interface MortgageSchedule {
  mortgage: Mortgage;
  events: MortgageEvent[];
  simulation: {
    rows: MortgageScheduleRow[];
    balance: number;
    currentPayment: number;
    rate: number;
    nextPayment: { date: string; amount: number } | null;
    overdueAmount: number;
    payoffDate: string | null;
    interestPaid: number;
    interestRemaining: number;
  };
}

export type AccountKind = 'cash' | 'debit' | 'savings' | 'deposit' | 'brokerage' | 'property' | 'other';

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  currency: string;
  institution: string | null;
  isLiquid: boolean;
  archivedAt: string | null;
  interestMode: InterestMode | null;
  payoutDay: number | null;
  maturityDate: string | null;
  /** tinvest when balances are synced from T-Bank Invest. */
  externalSource: string | null;
  externalId: string | null;
  createdAt: string;
}

export type InterestMode = 'daily' | 'monthly' | 'maturity';

export interface AccountInput {
  name: string;
  kind: AccountKind;
  currency: string;
  institution?: string | null;
  isLiquid: boolean;
  archivedAt?: string | null;
  interestMode?: InterestMode | null;
  payoutDay?: number | null;
  maturityDate?: string | null;
}

export type AccountEventKind = 'top_up' | 'withdrawal' | 'rate_change';

export interface AccountEvent {
  id: string;
  accountId: string;
  kind: AccountEventKind;
  eventDate: string;
  amount: number | null;
  rate: number | null;
  note: string | null;
}

export type AccountEventInput =
  | { kind: 'top_up' | 'withdrawal'; eventDate: string; amount: number; note?: string | null }
  | { kind: 'rate_change'; eventDate: string; rate: number; note?: string | null };

export interface SavingsSummary {
  terms: { mode: InterestMode; payoutDay: number | null; maturityDate: string | null } | null;
  events: AccountEvent[];
  savings: null | {
    balance: number;
    accrued: number;
    rate: number | null;
    daysWithoutRate: number;
    reconciliations: Array<{ date: string; expected: number; actual: number; difference: number }>;
    incomeByMonth: Array<{ month: string; amount: number }>;
    incomeThisYear: number;
    forecast: Array<{ months: number; date: string; balance: number }>;
  };
}

export interface TinvestStatus {
  connected: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  accounts: Array<{ id: string; name: string; type: string; total: number | null; linkedAccountId: string | null }>;
}

export type PortfolioPart = 'shares' | 'bonds' | 'etf' | 'currencies' | 'futures' | 'options' | 'structured';

export interface AccountPortfolio {
  accountId: string;
  syncedAt: string;
  data: {
    total: number;
    parts: Array<{ part: PortfolioPart; amount: number }>;
    expectedYieldPercent: number | null;
    dailyYield: number | null;
  };
}

export interface InterestTaxEstimate {
  year: number;
  incomeToDate: number;
  incomeForecast: number;
  limit: number;
  maxKeyRate: number | null;
  taxable: number;
  tax: number;
  keyRateStale: boolean;
  excludedCurrencies: string[];
  accounts: number;
}

export interface AccountBalance {
  id: string;
  accountId: string;
  balanceDate: string;
  amount: number;
  note: string | null;
}

export interface NetWorthAssetLine {
  accountId: string;
  name: string;
  kind: AccountKind;
  currency: string;
  isLiquid: boolean;
  amount: number | null;
  rubAmount: number | null;
  balanceDate: string | null;
  stale: boolean;
  /** Calculated from operations and interest rather than entered. */
  computed: boolean;
}

export interface NetWorthResult {
  asOf: string;
  assets: {
    lines: NetWorthAssetLine[];
    total: number;
    liquidTotal: number;
    propertyTotal: number;
    missingRates: string[];
    hasBalances: boolean;
  };
  ratesStale: boolean;
  debts: { total: number; cards: number; mortgages: number };
  realEstate: { value: number; mortgages: number; equity: number };
  netWorth: number;
  /** Assets without property, card debts and real estate equity at each date. */
  history: Array<{ date: string; assets: number | null; debts: number; realEstate: number; netWorth: number | null }>;
}
