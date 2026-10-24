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
  /** Minimum payment: a percent of the principal, but not less than the minimum; null on installment cards. */
  minPaymentPercent: number | null;
  minPaymentMinimum: number | null;
  /** latest — minimum payments and each bucket on its due date; even — buckets spread over the months. */
  payoffStrategy: PayoffStrategy;
  createdAt: string;
}

export type PayoffStrategy = 'latest' | 'even';

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
  categoryId?: string | null;
  /** rule | model | user; null while uncategorised. */
  categorySource?: CategorySource | null;
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
  /** Overdue payments and those due in the next 30 days. */
  payments: Array<{
    /** Card or mortgage id, depending on `kind`. */
    cardId: string;
    cardName: string;
    kind: DebtKind;
    dueDate: string;
    amount: number;
    status: 'overdue' | 'upcoming';
    /** How many card buckets are merged into this payment. */
    parts: number;
    /** Credit card: the statement period of the first merged bucket. */
    period?: { year: number; month: number };
    /** Installment card: the first merged purchase payment. */
    installment?: { number: number; count: number; description: string | null };
    /** Mortgage: payment number and its interest part. */
    mortgage?: { number: number; interest: number };
    /** Card paid late: the minimum payment and the buckets closed by this payment. */
    minimum?: number;
    closing?: number;
  }>;
}

export interface OverviewChartsResult {
  /** Debt payments by kind for the months ahead and the debt left after each month. */
  debtLoad: Array<{ month: string; credit: number; installment: number; mortgage: number; cardDebtEnd: number; mortgageEnd: number }>;
  /** Card purchases for the months behind, the current one included. */
  cardSpending: {
    cards: Array<{ id: string; name: string; kind: DebtKind }>;
    months: Array<{ month: string; total: number; byCard: Record<string, number> }>;
  };
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
  /** Cards paid late: the minimum payment and the buckets that must be closed by this date. */
  minimum?: number;
  closing?: number;
  overdue?: boolean;
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
  isCardReserve: boolean;
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
  isCardReserve?: boolean;
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

export type PlanItemKind = 'income' | 'expense' | 'transfer';
export type PlanFrequency = 'once' | 'weekly' | 'monthly' | 'yearly';

export interface PlanItemInput {
  name: string;
  kind: PlanItemKind;
  amount: number;
  currency: string;
  frequency: PlanFrequency;
  interval: number;
  startDate: string;
  endDate: string | null;
  spread: boolean;
  cardId: string | null;
  targetAccountId: string | null;
  note: string | null;
  /** Expense category, for plan versus actual card spending. */
  categoryId?: string | null;
  /** Rule pattern of the recurring purchase the item was suggested from. */
  sourcePattern?: string | null;
}

export interface PlanItem extends PlanItemInput {
  id: string;
  /** Monthly equivalent in the item currency; 0 for one-off items. */
  monthlyAmount: number;
}

export interface ForecastMonth {
  month: string;
  income: number;
  expenses: number;
  cardSpending: number;
  debtPayments: number;
  transfers: number;
  interest: number;
  liquidEnd: number;
  netWorthEnd: number;
}

export interface ForecastResult {
  today: string;
  until: string;
  start: { liquid: number; netWorth: number };
  daily: Array<{ date: string; liquid: number; netWorth: number }>;
  months: ForecastMonth[];
  minLiquid: { date: string; amount: number };
  planVsFact: Array<{ month: string; to: string; plan: number; fact: number | null; difference: number | null; estimated: boolean }>;
  missingRates: string[];
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
  isCardReserve: boolean;
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

export type CategorySource = 'rule' | 'model' | 'user';

export interface Category {
  id: string;
  name: string;
  /** Shipped reference categories whose merchant examples count for this one. */
  referenceCategories: string[];
}

export interface CategorySuggestion {
  categoryId: string;
  source: 'rule' | 'model';
  margin: number | null;
  /** Safe to assign without asking. */
  confident: boolean;
}

/** Purchases with the same description waiting for a category; ids are of the latest one. */
export interface CategoryReviewGroup {
  pattern: string;
  purchaseId: string;
  cardId: string;
  cardName: string;
  description: string | null;
  /** The description without bank boilerplate and city. */
  label: string | null;
  lastDate: string;
  count: number;
  total: number;
}

/** A purchase from any of the user's cards, as the category endpoints return it. */
export interface CategoryPurchase {
  id: string;
  cardId: string;
  cardName: string;
  purchaseDate: string;
  amount: number;
  description: string | null;
  categoryId: string | null;
  categorySource: CategorySource | null;
}

export interface PlanSuggestion {
  key: string;
  action: 'add' | 'update';
  kind: 'subscription' | 'budget';
  name: string;
  categoryId: string | null;
  amount: number;
  cardId: string | null;
  startDate: string;
  spread: boolean;
  sourcePattern: string | null;
  planItemId: string | null;
  currentAmount: number | null;
  /** Monthly totals the suggestion is based on, oldest first. */
  months: { month: string; amount: number }[];
}

/** Planned expenses and card purchases of a category in a month; categoryId null is uncategorised. */
export interface CategoryMonthRow {
  categoryId: string | null;
  plan: number;
  fact: number;
}
