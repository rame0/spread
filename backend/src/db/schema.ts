/**
 * V2 database schema — users, cards, purchases, deposits, grace_buckets, allocations.
 */

import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  date,
  timestamp,
  pgEnum,
  boolean,
  uniqueIndex,
  index,
  primaryKey,
  text,
  jsonb,
  real,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/** Money in roubles (or the account currency) with kopeck precision. */
const money = (name: string) => numeric(name, { precision: 16, scale: 2, mode: 'number' });
/** Annual interest rate in percent. */
const percent = (name: string) => numeric(name, { precision: 8, scale: 4, mode: 'number' });

export const graceBucketStatusEnum = pgEnum('grace_bucket_status', [
  'active',
  'closed',
  'overdue',
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  /** Default categories were created once; deleting them all must not bring them back. */
  categoriesSeeded: boolean('categories_seeded').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const cards = pgTable('cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  /** 'credit' — grace-period credit card, 'installment' — per-purchase installment plans. */
  kind: varchar('kind', { length: 16 }).notNull().default('credit'),
  reportDay: integer('report_day').notNull(),
  graceModel: varchar('grace_model', { length: 32 }).notNull().default('legacy_months'),
  gracePeriods: integer('grace_periods').notNull().default(4),
  graceDueDay: integer('grace_due_day').notNull(),
  graceStatementPeriods: integer('grace_statement_periods').notNull().default(4),
  paymentDueOffsetDays: integer('payment_due_offset_days').notNull().default(0),
  /** Minimum payment: a percent of the principal, but not less than the minimum. */
  minPaymentPercent: percent('min_payment_percent'),
  minPaymentMinimum: money('min_payment_minimum'),
  /** 'latest' — minimum payments and each bucket on its due date, 'even' — buckets spread over the months. */
  payoffStrategy: varchar('payoff_strategy', { length: 16 }).notNull().default('latest'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const purchases = pgTable('purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardId: uuid('card_id')
    .notNull()
    .references(() => cards.id, { onDelete: 'cascade' }),
  purchaseDate: date('purchase_date').notNull(),
  amount: money('amount').notNull(),
  description: varchar('description', { length: 512 }),
  /** Installment plan; null for purchases on credit cards. */
  installmentCount: integer('installment_count'),
  installmentInterval: varchar('installment_interval', { length: 8 }),
  firstPaymentDate: date('first_payment_date'),
  installmentFee: money('installment_fee').notNull().default(0),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  /** rule | model | user: an exact rule, the model above the margin threshold, or the user's choice. */
  categorySource: varchar('category_source', { length: 8 }),
  /** The model's lead of the chosen category over the runner-up. */
  categoryMargin: real('category_margin'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('purchases_category_idx').on(t.categoryId)]);

export const deposits = pgTable('deposits', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardId: uuid('card_id')
    .notNull()
    .references(() => cards.id, { onDelete: 'cascade' }),
  depositDate: date('deposit_date').notNull(),
  amount: money('amount').notNull(),
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
    principalTotal: money('principal_total').notNull(),
    principalRemaining: money('principal_remaining').notNull(),
    dueDate: date('due_date').notNull(),
    status: graceBucketStatusEnum('status').notNull().default('active'),
    /** Set for installment payments: one bucket per scheduled payment of a purchase. */
    purchaseId: uuid('purchase_id').references(() => purchases.id, { onDelete: 'cascade' }),
    installmentNumber: integer('installment_number'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('grace_buckets_card_period')
      .on(t.cardId, t.periodStartDate)
      .where(sql`${t.purchaseId} IS NULL`),
    index('grace_buckets_purchase_idx').on(t.purchaseId),
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
  amount: money('amount').notNull(),
});

/** An immutable confirmation of the balance reported by the bank. */
export const balanceReconciliations = pgTable('balance_reconciliations', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardId: uuid('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  reconciliationDate: date('reconciliation_date').notNull(),
  actualDebt: money('actual_debt').notNull(),
  calculatedDebtBefore: money('calculated_debt_before').notNull(),
  difference: money('difference').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/** Signed bucket changes made by a reconciliation. */
export const reconciliationAllocations = pgTable('reconciliation_allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  reconciliationId: uuid('reconciliation_id')
    .notNull()
    .references(() => balanceReconciliations.id, { onDelete: 'cascade' }),
  graceBucketId: uuid('grace_bucket_id')
    .notNull()
    .references(() => graceBuckets.id, { onDelete: 'cascade' }),
  amount: money('amount').notNull(),
});

/** Metadata for an uploaded bank statement. The PDF itself is never stored. */
export const statementImports = pgTable(
  'statement_imports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    bank: varchar('bank', { length: 32 }).notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileHash: varchar('file_hash', { length: 64 }).notNull(),
    periodStart: date('period_start'),
    periodEnd: date('period_end'),
    actualDebt: money('actual_debt'),
    reconciliationId: uuid('reconciliation_id').references(() => balanceReconciliations.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('statement_imports_card_hash').on(t.cardId, t.fileHash)]
);

/** Imported source rows, used as an audit trail and for idempotent re-imports. */
export const statementOperations = pgTable(
  'statement_operations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    statementImportId: uuid('statement_import_id')
      .notNull()
      .references(() => statementImports.id, { onDelete: 'cascade' }),
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    fingerprint: varchar('fingerprint', { length: 64 }).notNull(),
    sourceId: varchar('source_id', { length: 128 }),
    operationDate: date('operation_date').notNull(),
    operationTime: varchar('operation_time', { length: 8 }),
    kind: varchar('kind', { length: 16 }).notNull(),
    amount: money('amount').notNull(),
    description: varchar('description', { length: 512 }),
    purchaseId: uuid('purchase_id').references(() => purchases.id, { onDelete: 'set null' }),
    depositId: uuid('deposit_id').references(() => deposits.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('statement_operations_card_fingerprint').on(t.cardId, t.fingerprint),
    index('statement_operations_import_idx').on(t.statementImportId),
  ]
);

/** Annuity mortgage; its schedule is recomputed from these terms and mortgage_events. */
export const mortgages = pgTable(
  'mortgages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    principal: money('principal').notNull(),
    issueDate: date('issue_date').notNull(),
    annualRate: percent('annual_rate').notNull(),
    termMonths: integer('term_months').notNull(),
    paymentDay: integer('payment_day').notNull(),
    firstPaymentInterestOnly: boolean('first_payment_interest_only').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('mortgages_user_idx').on(t.userId)]
);

/** payment | prepayment | rate_change | reconciliation; only the fields of its kind are set. */
export const mortgageEvents = pgTable(
  'mortgage_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mortgageId: uuid('mortgage_id')
      .notNull()
      .references(() => mortgages.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 16 }).notNull(),
    eventDate: date('event_date').notNull(),
    amount: money('amount'),
    prepaymentMode: varchar('prepayment_mode', { length: 16 }),
    newRate: percent('new_rate'),
    actualBalance: money('actual_balance'),
    note: varchar('note', { length: 512 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('mortgage_events_mortgage_date').on(t.mortgageId, t.eventDate)]
);

/** cash | debit | savings | deposit | brokerage | property | other; balances are entered as dated snapshots. */
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    kind: varchar('kind', { length: 16 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('RUB'),
    institution: varchar('institution', { length: 255 }),
    /** Money available for everyday spending; deposits, brokerage accounts and property are not. */
    isLiquid: boolean('is_liquid').notNull().default(true),
    /** Savings kept to repay all card debt at once. */
    isCardReserve: boolean('is_card_reserve').notNull().default(false),
    /** The account counts towards net worth only before this date. */
    archivedAt: date('archived_at'),
    /** daily | monthly | maturity for savings and deposits; null when interest is not calculated. */
    interestMode: varchar('interest_mode', { length: 16 }),
    /** Day of the monthly interest payout; null means the last day of the month. */
    payoutDay: integer('payout_day'),
    /** End of a term deposit: interest stops accruing after it. */
    maturityDate: date('maturity_date'),
    /** Where balances come from automatically, e.g. tinvest; null for manual accounts. */
    externalSource: varchar('external_source', { length: 16 }),
    externalId: varchar('external_id', { length: 64 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('accounts_user_idx').on(t.userId),
    uniqueIndex('accounts_external').on(t.userId, t.externalSource, t.externalId),
  ]
);

/** Connection to an external data source; the token is encrypted (see auth/secretBox). */
export const integrations = pgTable(
  'integrations',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 16 }).notNull(),
    tokenEncrypted: text('token_encrypted').notNull(),
    lastSyncAt: timestamp('last_sync_at'),
    lastError: varchar('last_error', { length: 512 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.provider] })]
);

/** Latest structure of a brokerage portfolio, replaced on every sync. */
export const accountPortfolios = pgTable('account_portfolios', {
  accountId: uuid('account_id')
    .primaryKey()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  syncedAt: timestamp('synced_at').notNull(),
  data: jsonb('data').notNull(),
});

/** Balance reported by the bank on a date; one snapshot per account and day. */
export const accountBalances = pgTable(
  'account_balances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    balanceDate: date('balance_date').notNull(),
    amount: money('amount').notNull(),
    note: varchar('note', { length: 512 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('account_balances_account_date').on(t.accountId, t.balanceDate)]
);

/** top_up | withdrawal | rate_change of a savings account or deposit; only the fields of its kind are set. */
export const accountEvents = pgTable(
  'account_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 16 }).notNull(),
    eventDate: date('event_date').notNull(),
    amount: money('amount'),
    rate: percent('rate'),
    note: varchar('note', { length: 512 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('account_events_account_date').on(t.accountId, t.eventDate)]
);

/** CBR key rate in percent, effective from the date. */
export const keyRates = pgTable('key_rates', {
  rateDate: date('rate_date').primaryKey(),
  rate: percent('rate').notNull(),
});

/** Official CBR rates: roubles per one unit of the currency on a date. */
export const exchangeRates = pgTable(
  'exchange_rates',
  {
    rateDate: date('rate_date').notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    rubPerUnit: numeric('rub_per_unit', { precision: 18, scale: 6, mode: 'number' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.rateDate, t.currency] })]
);

/** income | expense | transfer repeating once | weekly | monthly | yearly from `startDate`. */
export const planItems = pgTable(
  'plan_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    kind: varchar('kind', { length: 16 }).notNull(),
    amount: money('amount').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('RUB'),
    frequency: varchar('frequency', { length: 16 }).notNull(),
    /** Every N weeks, months or years. */
    interval: integer('interval').notNull().default(1),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    /** An expense spent evenly over the days of its period instead of at once. */
    spread: boolean('spread').notNull().default(false),
    /** The expense is paid with this card and leaves the accounts when the card is repaid. */
    cardId: uuid('card_id').references(() => cards.id, { onDelete: 'set null' }),
    /** Savings account or deposit a transfer goes to. */
    targetAccountId: uuid('target_account_id').references(() => accounts.id, { onDelete: 'set null' }),
    note: varchar('note', { length: 512 }),
    /** Expense category, for plan versus actual card spending. */
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    /** Rule pattern of the recurring purchase this item was suggested from. */
    sourcePattern: varchar('source_pattern', { length: 512 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('plan_items_user_idx').on(t.userId)]
);

/** A plan suggestion the user hid; it returns when its amount moves noticeably. */
export const planSuggestionDismissals = pgTable(
  'plan_suggestion_dismissals',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 600 }).notNull(),
    amount: money('amount').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })]
);

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 64 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('categories_user_name').on(t.userId, sql`lower(${t.name})`)]
);

/** Which user category the examples of a shipped reference category count for. */
export const categoryReferenceMap = pgTable(
  'category_reference_map',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    referenceCategory: varchar('reference_category', { length: 64 }).notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.referenceCategory] })]
);

/** A description the user categorised: an exact rule and an example for the nearest-neighbour lookup. */
export const categoryRules = pgTable(
  'category_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pattern: varchar('pattern', { length: 512 }).notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    /** Embedding of the pattern by `modelVersion`; recomputed when the model changes. */
    embedding: real('embedding').array(),
    modelVersion: varchar('model_version', { length: 32 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('category_rules_user_pattern').on(t.userId, t.pattern)]
);
