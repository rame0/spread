import path from 'path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from './schema';
import { config } from '../config/env';

const pool = new Pool({
  connectionString: config.databaseUrl,
});

export const db = drizzle(pool, { schema });
export * from './schema';

/** Run pending migrations (path from dist/db/ -> backend/drizzle). */
export async function runMigrations(): Promise<void> {
  const migrationsFolder = path.join(__dirname, '..', '..', 'drizzle');
  await migrate(db, { migrationsFolder });
}
