import axios from 'axios';
import type {
  User,
  Card,
  CardKind,
  InstallmentPlan,
  Purchase,
  Deposit,
  DashboardResult,
  MainDashboardResult,
  ActivityChartPeriod,
  ActivityChartResult,
  PeriodPlanRow,
  GraceBucket,
  CardExportPayload,
  CardImportResult,
  BalanceReconciliation,
  StatementPreview,
  StatementImportResult,
  StatementImportHistoryItem,
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
  }>
): Promise<Card> {
  const { data } = await api.patch<Card>(`/cards/${cardId}/settings`, params);
  return data;
}

export async function getBuckets(
  cardId: string,
  asOf?: string
): Promise<GraceBucket[]> {
  const { data } = await api.get<GraceBucket[]>(`/cards/${cardId}/buckets`, {
    params: asOf ? { asOf } : undefined,
  });
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

export async function getMainActivityChart(period: ActivityChartPeriod): Promise<ActivityChartResult> {
  const { data } = await api.get<ActivityChartResult>('/dashboard/activity-chart', { params: { period } });
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
  from?: string,
  to?: string
): Promise<Purchase[]> {
  const { data } = await api.get<Purchase[]>(`/cards/${cardId}/purchases`, {
    params: { from, to },
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

// Deposits
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
