/**
 * V2 database schema — users, cards, purchases, deposits, grace_buckets, allocations.
 */

import {
  pgTable,
  uuid,
  varchar,
  integer,
  real,
  date,
  timestamp,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const graceBucketStatusEnum = pgEnum('grace_bucket_status', [
  'active',
  'closed',
  'overdue',
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const cards = pgTable('cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  reportDay: integer('report_day').notNull(),
  graceModel: varchar('grace_model', { length: 32 }).notNull().default('legacy_months'),
  gracePeriods: integer('grace_periods').notNull().default(4),
  graceDueDay: integer('grace_due_day').notNull(),
  graceStatementPeriods: integer('grace_statement_periods').notNull().default(4),
  paymentDueOffsetDays: integer('payment_due_offset_days').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const purchases = pgTable('purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardId: uuid('card_id')
    .notNull()
    .references(() => cards.id, { onDelete: 'cascade' }),
  purchaseDate: date('purchase_date').notNull(),
  amount: real('amount').notNull(),
  description: varchar('description', { length: 512 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const deposits = pgTable('deposits', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardId: uuid('card_id')
    .notNull()
    .references(() => cards.id, { onDelete: 'cascade' }),
  depositDate: date('deposit_date').notNull(),
  amount: real('amount').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const graceBuckets = pgTable(
  'grace_buckets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    periodYear: integer('period_year').notNull(),
    periodMonth: integer('period_month').notNull(),
    periodStartDate: date('period_start_date').notNull(),
    principalTotal: real('principal_total').notNull(),
    principalRemaining: real('principal_remaining').notNull(),
    dueDate: date('due_date').notNull(),
    status: graceBucketStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('grace_buckets_card_period').on(t.cardId, t.periodStartDate),
  ]
);

export const allocations = pgTable('allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  depositId: uuid('deposit_id')
    .notNull()
    .references(() => deposits.id, { onDelete: 'cascade' }),
  graceBucketId: uuid('grace_bucket_id')
    .notNull()
    .references(() => graceBuckets.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(),
});
