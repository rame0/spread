CREATE TABLE "balance_reconciliations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "card_id" uuid NOT NULL REFERENCES "cards"("id") ON DELETE cascade,
  "reconciliation_date" date NOT NULL,
  "actual_debt" real NOT NULL,
  "calculated_debt_before" real NOT NULL,
  "difference" real NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_allocations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reconciliation_id" uuid NOT NULL REFERENCES "balance_reconciliations"("id") ON DELETE cascade,
  "grace_bucket_id" uuid NOT NULL REFERENCES "grace_buckets"("id") ON DELETE cascade,
  "amount" real NOT NULL
);
--> statement-breakpoint
CREATE INDEX "balance_reconciliations_card_date" ON "balance_reconciliations" USING btree ("card_id", "reconciliation_date");
