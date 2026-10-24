import axios from 'axios';
import type {
  User,
  Card,
  CardKind,
  PayoffStrategy,
  InstallmentPlan,
  Purchase,
  PurchasePage,
  Category,
  CategoryPurchase,
  CategoryReviewGroup,
  CategorySuggestion,
  Deposit,
  DashboardResult,
  MainDashboardResult,
  OverviewChartsResult,
  ActivityChartPeriod,
  ActivityChartResult,
  PeriodPlanRow,
  CardExportPayload,
  CardImportResult,
  BalanceReconciliation,
  StatementPreview,
  StatementImportResult,
  StatementImportHistoryItem,
  Mortgage,
  MortgageEvent,
  MortgageEventInput,
  MortgageInput,
  MortgageSchedule,
  Account,
  AccountBalance,
  AccountInput,
  AccountEvent,
  AccountEventInput,
  InterestTaxEstimate,
  NetWorthResult,
  SavingsSummary,
  TinvestStatus,
  AccountPortfolio,
  PlanItem,
  PlanItemInput,
  PlanSuggestion,
  CategoryMonthRow,
  ForecastResult,
} from '../types/v2';

const CSRF_COOKIE_NAME = 'grace_planner_csrf';

function getCookie(name: string): string | null {
  const parts = document.cookie
    .split(';')
    .map((v) => v.trim())
    .filter(Boolean);
  for (const part of parts) {
    const [cookieName, ...rest] = part.split('=');
    if (cookieName === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    config.headers.delete('Content-Type');
  }
  const method = (config.method || 'get').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = getCookie(CSRF_COOKIE_NAME);
    if (csrfToken) {
      config.headers['x-csrf-token'] = csrfToken;
    }
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => Promise.reject(err)
);

// Auth
export async function register(
  email: string,
  password: string
): Promise<{ user: User; csrfToken: string }> {
  const { data } = await api.post<{ user: User; csrfToken: string }>(
    '/auth/register',
    { email, password }
  );
  return data;
}

export async function login(
  email: string,
  password: string
): Promise<{ user: User; csrfToken: string }> {
  const { data } = await api.post<{ user: User; csrfToken: string }>(
    '/auth/login',
    { email, password }
  );
  return data;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me');
  return data;
}

// Cards
export async function getCards(): Promise<Card[]> {
  const { data } = await api.get<Card[]>('/cards');
  return data;
}

export async function createCard(params: {
  name: string;
  kind?: CardKind;
  reportDay?: number;
  graceModel?: 'legacy_months' | 'statement_periods' | 'ozon_anchor';
  gracePeriods?: number;
  graceDueDay?: number;
  graceStatementPeriods?: number;
  paymentDueOffsetDays?: number;
}): Promise<Card> {
  const { data } = await api.post<Card>('/cards', params);
  return data;
}

export async function getCard(cardId: string): Promise<Card> {
  const { data } = await api.get<Card>(`/cards/${cardId}`);
  return data;
}

export async function patchCardSettings(
  cardId: string,
  params: Partial<{
    reportDay: number;
    graceModel: 'legacy_months' | 'statement_periods' | 'ozon_anchor';
    gracePeriods: number;
    graceDueDay: number;
    graceStatementPeriods: number;
    paymentDueOffsetDays: number;
    minPaymentPercent: number;
    minPaymentMinimum: number;
    payoffStrategy: PayoffStrategy;
  }>
): Promise<Card> {
  const { data } = await api.patch<Card>(`/cards/${cardId}/settings`, params);
  return data;
}


export async function getDashboard(
  cardId: string,
  asOf?: string
): Promise<DashboardResult> {
  const { data } = await api.get<DashboardResult>(
    `/cards/${cardId}/dashboard`,
    { params: asOf ? { asOf } : undefined }
  );
  return data;
}

export async function getMainDashboard(): Promise<MainDashboardResult> {
  const { data } = await api.get<MainDashboardResult>('/dashboard');
  return data;
}


export async function getActivityChart(
  cardId: string,
  period: ActivityChartPeriod
): Promise<ActivityChartResult> {
  const { data } = await api.get<ActivityChartResult>(`/cards/${cardId}/activity-chart`, {
    params: { period },
  });
  return data;
}

export async function getPlan(
  cardId: string,
  asOf?: string
): Promise<PeriodPlanRow[]> {
  const { data } = await api.get<PeriodPlanRow[]>(`/cards/${cardId}/plan`, {
    params: asOf ? { asOf } : undefined,
  });
  return data;
}

// Purchases
export async function getPurchases(
  cardId: string,
  page: { limit: number; offset: number; query?: string }
): Promise<PurchasePage> {
  const { data } = await api.get<PurchasePage>(`/cards/${cardId}/purchases`, {
    params: { limit: page.limit, offset: page.offset, q: page.query || undefined },
  });
  return data;
}

export async function addPurchase(
  cardId: string,
  params: { purchaseDate: string; amount: number; description?: string; plan?: InstallmentPlan }
): Promise<Purchase> {
  const { data } = await api.post<Purchase>(
    `/cards/${cardId}/purchases`,
    params
  );
  return data;
}

// Categories
export async function getCategories(): Promise<Category[]> {
  const { data } = await api.get<Category[]>('/categories');
  return data;
}

export async function getReferenceCategories(): Promise<string[]> {
  const { data } = await api.get<string[]>('/categories/reference');
  return data;
}

export async function createCategory(params: { name: string; referenceCategories?: string[] }): Promise<Category> {
  const { data } = await api.post<Category>('/categories', params);
  return data;
}

export async function updateCategory(id: string, params: { name?: string; referenceCategories?: string[] }): Promise<Category> {
  const { data } = await api.patch<Category>(`/categories/${id}`, params);
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  await api.delete(`/categories/${id}`);
}

export async function suggestCategory(text: string): Promise<CategorySuggestion | null> {
  const { data } = await api.get<CategorySuggestion | null>('/categories/suggest', { params: { text } });
  return data;
}

export async function getUncategorizedPurchases(): Promise<CategoryReviewGroup[]> {
  const { data } = await api.get<CategoryReviewGroup[]>('/categories/uncategorized');
  return data;
}

export async function backfillCategories(): Promise<{ categorized: number; remaining: number }> {
  const { data } = await api.post<{ categorized: number; remaining: number }>('/categories/backfill');
  return data;
}

/** The user's choice; it also becomes a rule for the same description. */
export async function setPurchaseCategory(cardId: string, purchaseId: string, categoryId: string | null): Promise<CategoryPurchase> {
  const { data } = await api.patch<CategoryPurchase>(`/cards/${cardId}/purchases/${purchaseId}/category`, { categoryId });
  return data;
}

// Deposits
/** Due date a purchase on this date would get; null on installment cards. */
export async function getPurchaseDueDate(cardId: string, date: string): Promise<string | null> {
  const { data } = await api.get<{ dueDate: string | null }>(`/cards/${cardId}/purchase-due-date`, { params: { date } });
  return data.dueDate;
}

export async function getDeposits(
  cardId: string,
  from?: string,
  to?: string
): Promise<Deposit[]> {
  const { data } = await api.get<Deposit[]>(`/cards/${cardId}/deposits`, {
    params: { from, to },
  });
  return data;
}

export async function addDeposit(
  cardId: string,
  params: { depositDate: string; amount: number }
): Promise<Deposit> {
  const { data } = await api.post<Deposit>(
    `/cards/${cardId}/deposits`,
    params
  );
  return data;
}

export async function getReconciliations(cardId: string): Promise<BalanceReconciliation[]> {
  const { data } = await api.get<BalanceReconciliation[]>(`/cards/${cardId}/reconciliations`);
  return data;
}

export async function addReconciliation(
  cardId: string,
  params: { reconciliationDate: string; actualDebt: number }
): Promise<BalanceReconciliation> {
  const { data } = await api.post<BalanceReconciliation>(`/cards/${cardId}/reconciliations`, params);
  return data;
}

export async function exportCard(cardId: string): Promise<CardExportPayload> {
  const { data } = await api.get<CardExportPayload>(`/cards/${cardId}/export`);
  return data;
}

export async function importCard(
  cardId: string,
  payload: CardExportPayload
): Promise<CardImportResult> {
  const { data } = await api.post<CardImportResult>(
    `/cards/${cardId}/import`,
    payload
  );
  return data;
}

export async function previewStatement(cardId: string, file: File): Promise<StatementPreview> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<StatementPreview>(`/cards/${cardId}/statements/preview`, form);
  return data;
}

export async function importStatement(
  cardId: string,
  file: File,
  selectedFingerprints: string[],
  reconcile: boolean
): Promise<StatementImportResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('selectedFingerprints', JSON.stringify(selectedFingerprints));
  form.append('reconcile', String(reconcile));
  const { data } = await api.post<StatementImportResult>(`/cards/${cardId}/statements/import`, form);
  return data;
}

export async function getStatementImports(cardId: string): Promise<StatementImportHistoryItem[]> {
  const { data } = await api.get<StatementImportHistoryItem[]>(`/cards/${cardId}/statements`);
  return data;
}

// Mortgages
export async function getMortgages(): Promise<Mortgage[]> {
  const { data } = await api.get<Mortgage[]>('/mortgages');
  return data;
}

export async function createMortgage(params: MortgageInput): Promise<Mortgage> {
  const { data } = await api.post<Mortgage>('/mortgages', params);
  return data;
}

export async function patchMortgage(mortgageId: string, params: Partial<MortgageInput>): Promise<Mortgage> {
  const { data } = await api.patch<Mortgage>(`/mortgages/${mortgageId}`, params);
  return data;
}

export async function deleteMortgage(mortgageId: string): Promise<void> {
  await api.delete(`/mortgages/${mortgageId}`);
}

export async function getMortgageSchedule(mortgageId: string): Promise<MortgageSchedule> {
  const { data } = await api.get<MortgageSchedule>(`/mortgages/${mortgageId}/schedule`);
  return data;
}

export async function addMortgageEvent(mortgageId: string, params: MortgageEventInput): Promise<MortgageEvent> {
  const { data } = await api.post<MortgageEvent>(`/mortgages/${mortgageId}/events`, params);
  return data;
}

export async function deleteMortgageEvent(mortgageId: string, eventId: string): Promise<void> {
  await api.delete(`/mortgages/${mortgageId}/events/${eventId}`);
}

export async function markMortgagePaidUntil(mortgageId: string, until: string): Promise<{ created: number }> {
  const { data } = await api.post<{ created: number }>(`/mortgages/${mortgageId}/mark-paid-until`, { until });
  return data;
}

// Accounts
export async function getAccounts(): Promise<Account[]> {
  const { data } = await api.get<Account[]>('/accounts');
  return data;
}

export async function getAccount(accountId: string): Promise<Account> {
  const { data } = await api.get<Account>(`/accounts/${accountId}`);
  return data;
}

export async function createAccount(
  params: AccountInput & { initialBalance?: { date: string; amount: number } }
): Promise<Account> {
  const { data } = await api.post<Account>('/accounts', params);
  return data;
}

export async function patchAccount(accountId: string, params: Partial<AccountInput>): Promise<Account> {
  const { data } = await api.patch<Account>(`/accounts/${accountId}`, params);
  return data;
}

export async function deleteAccount(accountId: string): Promise<void> {
  await api.delete(`/accounts/${accountId}`);
}

export async function getAccountBalances(accountId: string): Promise<AccountBalance[]> {
  const { data } = await api.get<AccountBalance[]>(`/accounts/${accountId}/balances`);
  return data;
}

export async function saveAccountBalance(
  accountId: string,
  balanceDate: string,
  params: { amount: number; note?: string | null }
): Promise<AccountBalance> {
  const { data } = await api.put<AccountBalance>(`/accounts/${accountId}/balances/${balanceDate}`, params);
  return data;
}

/** Saves balances of several accounts for one date in one transaction. */
export async function saveAccountBalances(balanceDate: string, balances: Array<{ accountId: string; amount: number }>): Promise<AccountBalance[]> {
  const { data } = await api.put<AccountBalance[]>(`/accounts/balances/${balanceDate}`, { balances });
  return data;
}

export async function deleteAccountBalance(accountId: string, balanceDate: string): Promise<void> {
  await api.delete(`/accounts/${accountId}/balances/${balanceDate}`);
}

export async function getSavings(accountId: string): Promise<SavingsSummary> {
  const { data } = await api.get<SavingsSummary>(`/accounts/${accountId}/savings`);
  return data;
}

export async function createAccountEvent(accountId: string, params: AccountEventInput): Promise<AccountEvent> {
  const { data } = await api.post<AccountEvent>(`/accounts/${accountId}/events`, params);
  return data;
}

export async function deleteAccountEvent(accountId: string, eventId: string): Promise<void> {
  await api.delete(`/accounts/${accountId}/events/${eventId}`);
}

export async function getInterestTax(year?: number): Promise<InterestTaxEstimate> {
  const { data } = await api.get<InterestTaxEstimate>('/accounts/interest-tax', { params: year ? { year } : {} });
  return data;
}

export async function getAccountPortfolio(accountId: string): Promise<AccountPortfolio | null> {
  const { data } = await api.get<AccountPortfolio | null>(`/accounts/${accountId}/portfolio`);
  return data;
}

// T-Bank Invest
export async function getTinvestStatus(): Promise<TinvestStatus> {
  const { data } = await api.get<TinvestStatus>('/integrations/tinvest');
  return data;
}

export async function connectTinvest(token: string): Promise<TinvestStatus> {
  const { data } = await api.put<TinvestStatus>('/integrations/tinvest', { token });
  return data;
}

export async function disconnectTinvest(): Promise<void> {
  await api.delete('/integrations/tinvest');
}

export async function linkTinvestAccount(externalId: string): Promise<Account> {
  const { data } = await api.post<Account>(`/integrations/tinvest/accounts/${externalId}`);
  return data;
}

export async function syncTinvest(): Promise<{ synced: number; error: string | null }> {
  const { data } = await api.post<{ synced: number; error: string | null }>('/integrations/tinvest/sync');
  return data;
}

export async function getOverviewCharts(months = 12): Promise<OverviewChartsResult> {
  const { data } = await api.get<OverviewChartsResult>('/dashboard/charts', { params: { months } });
  return data;
}

export async function getNetWorth(months = 12): Promise<NetWorthResult> {
  const { data } = await api.get<NetWorthResult>('/dashboard/net-worth', { params: { months } });
  return data;
}

// Plan
export async function getPlanItems(): Promise<PlanItem[]> {
  const { data } = await api.get<PlanItem[]>('/plan/items');
  return data;
}

export async function createPlanItem(params: PlanItemInput): Promise<PlanItem> {
  const { data } = await api.post<PlanItem>('/plan/items', params);
  return data;
}

export async function patchPlanItem(itemId: string, params: Partial<PlanItemInput>): Promise<PlanItem> {
  const { data } = await api.patch<PlanItem>(`/plan/items/${itemId}`, params);
  return data;
}

export async function getPlanSuggestions(): Promise<PlanSuggestion[]> {
  const { data } = await api.get<PlanSuggestion[]>('/plan/suggestions');
  return data;
}

/** Hides the suggestion until its amount moves noticeably. */
export async function dismissPlanSuggestion(key: string, amount: number): Promise<void> {
  await api.post('/plan/suggestions/dismiss', { key, amount });
}

export async function getCategoryMonth(month: string): Promise<CategoryMonthRow[]> {
  const { data } = await api.get<CategoryMonthRow[]>('/plan/categories', { params: { month } });
  return data;
}

export async function deletePlanItem(itemId: string): Promise<void> {
  await api.delete(`/plan/items/${itemId}`);
}

export async function getForecast(months = 12): Promise<ForecastResult> {
  const { data } = await api.get<ForecastResult>('/plan/forecast', { params: { months } });
  return data;
}
