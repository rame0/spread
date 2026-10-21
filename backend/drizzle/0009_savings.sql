ALTER TABLE "accounts" ADD COLUMN "interest_mode" varchar(16);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "payout_day" integer;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "maturity_date" date;
--> statement-breakpoint
CREATE TABLE "account_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "kind" varchar(16) NOT NULL,
  "event_date" date NOT NULL,
  "amount" numeric(16,2),
  "rate" numeric(8,4),
  "note" varchar(512),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "key_rates" (
  "rate_date" date PRIMARY KEY NOT NULL,
  "rate" numeric(8,4) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "account_events_account_date" ON "account_events" USING btree ("account_id", "event_date");
