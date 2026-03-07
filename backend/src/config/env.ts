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

export const config = {
  port: parseInt(env('PORT', '3001'), 10),
  nodeEnv: env('NODE_ENV', 'development'),
  databaseUrl: envRequiredInProduction(
    'DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/credit_grace'
  ),
  jwtSecret: envRequiredInProduction('JWT_SECRET', 'dev-only-local-secret'),
} as const;
