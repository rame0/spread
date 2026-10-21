CREATE TABLE "accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "name" varchar(255) NOT NULL,
  "kind" varchar(16) NOT NULL,
  "currency" varchar(3) DEFAULT 'RUB' NOT NULL,
  "institution" varchar(255),
  "is_liquid" boolean DEFAULT true NOT NULL,
  "archived_at" date,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_balances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "balance_date" date NOT NULL,
  "amount" numeric(16,2) NOT NULL,
  "note" varchar(512),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
  "rate_date" date NOT NULL,
  "currency" varchar(3) NOT NULL,
  "rub_per_unit" numeric(18,6) NOT NULL,
  PRIMARY KEY ("rate_date", "currency")
);
--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "account_balances_account_date" ON "account_balances" USING btree ("account_id", "balance_date");
