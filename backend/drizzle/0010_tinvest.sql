CREATE TABLE "integrations" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "provider" varchar(16) NOT NULL,
  "token_encrypted" text NOT NULL,
  "last_sync_at" timestamp,
  "last_error" varchar(512),
  "created_at" timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY ("user_id", "provider")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "external_source" varchar(16);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "external_id" varchar(64);
--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_external" ON "accounts" USING btree ("user_id", "external_source", "external_id");
--> statement-breakpoint
CREATE TABLE "account_portfolios" (
  "account_id" uuid PRIMARY KEY NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "synced_at" timestamp NOT NULL,
  "data" jsonb NOT NULL
);
