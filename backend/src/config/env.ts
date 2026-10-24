/**
 * Environment and app config.
 */

function env(key: string, defaultValue?: string): string {
  const v = process.env[key];
  if (v !== undefined && v !== '') return v;
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`Missing env: ${key}`);
}

function isProduction(): boolean {
  return (process.env.NODE_ENV || 'development') === 'production';
}

function envRequiredInProduction(key: string, defaultValue?: string): string {
  if (isProduction()) {
    return env(key);
  }
  return env(key, defaultValue);
}

function parseIntEnv(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (!raw) return defaultValue;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid integer env: ${key}`);
  }
  return parsed;
}

function parseCorsOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((v) => v.trim())
    .map((v) => (v.endsWith('/') ? v.slice(0, -1) : v))
    .filter(Boolean);
}

function parseCookieSecureMode(raw: string): 'auto' | boolean {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'auto') return 'auto';
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error('Invalid AUTH_COOKIE_SECURE value. Use auto|true|false');
}

export const config = {
  port: parseInt(env('PORT', '3001'), 10),
  nodeEnv: env('NODE_ENV', 'development'),
  databaseUrl: envRequiredInProduction(
    'DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/credit_grace'
  ),
  jwtSecret: envRequiredInProduction('JWT_SECRET', 'dev-only-local-secret'),
  corsOrigins: parseCorsOrigins(
    env('CORS_ORIGINS', 'http://localhost:3000,http://credit.local,https://credit.local')
  ),
  jsonBodyLimit: env('JSON_BODY_LIMIT', '256kb'),
  globalRateLimitWindowMs: parseIntEnv('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  globalRateLimitMax: parseIntEnv('RATE_LIMIT_MAX', 500),
  authRateLimitMax: parseIntEnv('AUTH_RATE_LIMIT_MAX', 20),
  authCookieName: env('AUTH_COOKIE_NAME', 'grace_planner_auth'),
  csrfCookieName: env('CSRF_COOKIE_NAME', 'grace_planner_csrf'),
  authCookieSecure: parseCookieSecureMode(env('AUTH_COOKIE_SECURE', 'auto')),
  /** false turns expense categorisation off; exact rules still apply. */
  categorizeModel: env('CATEGORIZE_MODEL', 'true') !== 'false',
  /** Model's lead over the runner-up category needed to assign without asking. */
  categorizeMinMargin: parseFloat(env('CATEGORIZE_MIN_MARGIN', '0.1')),
  categorizeIdleMs: parseIntEnv('CATEGORIZE_IDLE_MS', 10 * 60 * 1000),
} as const;
