CREATE TABLE "mortgages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "name" varchar(255) NOT NULL,
  "principal" real NOT NULL,
  "issue_date" date NOT NULL,
  "annual_rate" real NOT NULL,
  "term_months" integer NOT NULL,
  "payment_day" integer NOT NULL,
  "first_payment_interest_only" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mortgage_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "mortgage_id" uuid NOT NULL REFERENCES "mortgages"("id") ON DELETE cascade,
  "kind" varchar(16) NOT NULL,
  "event_date" date NOT NULL,
  "amount" real,
  "prepayment_mode" varchar(16),
  "new_rate" real,
  "actual_balance" real,
  "note" varchar(512),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "mortgages_user_idx" ON "mortgages" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "mortgage_events_mortgage_date" ON "mortgage_events" USING btree ("mortgage_id", "event_date");
