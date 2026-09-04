import path from 'path';
import fs from 'fs';
import { createHash } from 'crypto';
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

interface MigrationJournal {
  entries: Array<{ tag: string; when: number }>;
}

/**
 * Older installations were created before Drizzle's journal was enabled. Mark
 * only the newest migration whose schema is already present, then let Drizzle
 * apply everything after it normally.
 */
async function baselineLegacyDatabase(migrationsFolder: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('credit-grace-planner-migrations'))");
    await client.query('CREATE SCHEMA IF NOT EXISTS drizzle');
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);
    const countResult = await client.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM drizzle.__drizzle_migrations'
    );
    if (Number(countResult.rows[0]?.count ?? 0) > 0) {
      await client.query('COMMIT');
      return;
    }
    const stateResult = await client.query<{
      base_ready: boolean;
      grace_settings_ready: boolean;
      period_start_ready: boolean;
      reconciliations_ready: boolean;
      statements_ready: boolean;
    }>(`
      SELECT
        to_regclass('public.users') IS NOT NULL
          AND to_regclass('public.cards') IS NOT NULL
          AND to_regclass('public.purchases') IS NOT NULL
          AND to_regclass('public.deposits') IS NOT NULL
          AND to_regclass('public.grace_buckets') IS NOT NULL
          AND to_regclass('public.allocations') IS NOT NULL AS base_ready,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cards' AND column_name = 'grace_model')
          AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cards' AND column_name = 'grace_statement_periods')
          AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cards' AND column_name = 'payment_due_offset_days') AS grace_settings_ready,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'grace_buckets' AND column_name = 'period_start_date') AS period_start_ready,
        to_regclass('public.balance_reconciliations') IS NOT NULL
          AND to_regclass('public.reconciliation_allocations') IS NOT NULL AS reconciliations_ready,
        to_regclass('public.statement_imports') IS NOT NULL
          AND to_regclass('public.statement_operations') IS NOT NULL AS statements_ready
    `);
    const state = stateResult.rows[0];
    if (!state?.base_ready) {
      await client.query('COMMIT');
      return;
    }
    const tag = state.statements_ready
      ? '0004_statement_imports'
      : state.reconciliations_ready
        ? '0003_balance_reconciliations'
        : state.period_start_ready
          ? '0002_calm_slipstream'
          : state.grace_settings_ready
            ? '0001_youthful_hairball'
            : '0000_v2_init';
    const journal = JSON.parse(
      fs.readFileSync(path.join(migrationsFolder, 'meta', '_journal.json'), 'utf8')
    ) as MigrationJournal;
    const entry = journal.entries.find((candidate) => candidate.tag === tag);
    if (!entry) throw new Error(`Migration journal entry not found: ${tag}`);
    const migrationSql = fs.readFileSync(path.join(migrationsFolder, `${tag}.sql`), 'utf8');
    const hash = createHash('sha256').update(migrationSql).digest('hex');
    await client.query(
      'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
      [hash, entry.when]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Run pending migrations (path from dist/db/ -> backend/drizzle). */
export async function runMigrations(): Promise<void> {
  const migrationsFolder = path.join(__dirname, '..', '..', 'drizzle');
  await baselineLegacyDatabase(migrationsFolder);
  await migrate(db, { migrationsFolder });
}

export async function pingDb(): Promise<boolean> {
  try {
    await pool.query('select 1');
    return true;
  } catch {
    return false;
  }
}
