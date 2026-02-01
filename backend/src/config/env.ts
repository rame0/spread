/**
 * Environment and app config.
 */

function env(key: string, defaultValue?: string): string {
  const v = process.env[key];
  if (v !== undefined && v !== '') return v;
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`Missing env: ${key}`);
}

export const config = {
  port: parseInt(env('PORT', '3001'), 10),
  nodeEnv: env('NODE_ENV', 'development'),
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/credit_grace',
} as const;
