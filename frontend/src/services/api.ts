import axios from 'axios';
import type {
  User,
  Card,
  Purchase,
  Deposit,
  DashboardResult,
  PeriodPlanRow,
  GraceBucket,
  CardExportPayload,
  CardImportResult,
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
  reportDay: number;
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
  params: { purchaseDate: string; amount: number; description?: string }
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
