ALTER TABLE "accounts" ADD COLUMN "opened_at" date;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "ruleset" varchar(32);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "unlock_date" date;
--> statement-breakpoint
ALTER TABLE "account_events" ADD COLUMN "external_id" varchar(64);
--> statement-breakpoint
CREATE UNIQUE INDEX "account_events_external" ON "account_events" ("account_id", "external_id");
--> statement-breakpoint
CREATE TABLE "tax_years" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "year" integer NOT NULL,
  "annual_income" numeric(16,2),
  "other_deductible" numeric(16,2) DEFAULT 0 NOT NULL,
  "refund_received" numeric(16,2),
  "updated_at" timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY ("user_id", "year")
);
