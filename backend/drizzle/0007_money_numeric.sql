ALTER TABLE "purchases"
  ALTER COLUMN "amount" TYPE numeric(16,2) USING round("amount"::double precision::numeric, 2),
  ALTER COLUMN "installment_fee" TYPE numeric(16,2) USING round("installment_fee"::double precision::numeric, 2);
--> statement-breakpoint
ALTER TABLE "deposits"
  ALTER COLUMN "amount" TYPE numeric(16,2) USING round("amount"::double precision::numeric, 2);
--> statement-breakpoint
ALTER TABLE "grace_buckets"
  ALTER COLUMN "principal_total" TYPE numeric(16,2) USING round("principal_total"::double precision::numeric, 2),
  ALTER COLUMN "principal_remaining" TYPE numeric(16,2) USING round("principal_remaining"::double precision::numeric, 2);
--> statement-breakpoint
ALTER TABLE "allocations"
  ALTER COLUMN "amount" TYPE numeric(16,2) USING round("amount"::double precision::numeric, 2);
--> statement-breakpoint
ALTER TABLE "balance_reconciliations"
  ALTER COLUMN "actual_debt" TYPE numeric(16,2) USING round("actual_debt"::double precision::numeric, 2),
  ALTER COLUMN "calculated_debt_before" TYPE numeric(16,2) USING round("calculated_debt_before"::double precision::numeric, 2),
  ALTER COLUMN "difference" TYPE numeric(16,2) USING round("difference"::double precision::numeric, 2);
--> statement-breakpoint
ALTER TABLE "reconciliation_allocations"
  ALTER COLUMN "amount" TYPE numeric(16,2) USING round("amount"::double precision::numeric, 2);
--> statement-breakpoint
ALTER TABLE "statement_imports"
  ALTER COLUMN "actual_debt" TYPE numeric(16,2) USING round("actual_debt"::double precision::numeric, 2);
--> statement-breakpoint
ALTER TABLE "statement_operations"
  ALTER COLUMN "amount" TYPE numeric(16,2) USING round("amount"::double precision::numeric, 2);
--> statement-breakpoint
ALTER TABLE "mortgages"
  ALTER COLUMN "principal" TYPE numeric(16,2) USING round("principal"::double precision::numeric, 2),
  ALTER COLUMN "annual_rate" TYPE numeric(8,4) USING round("annual_rate"::double precision::numeric, 4);
--> statement-breakpoint
ALTER TABLE "mortgage_events"
  ALTER COLUMN "amount" TYPE numeric(16,2) USING round("amount"::double precision::numeric, 2),
  ALTER COLUMN "new_rate" TYPE numeric(8,4) USING round("new_rate"::double precision::numeric, 4),
  ALTER COLUMN "actual_balance" TYPE numeric(16,2) USING round("actual_balance"::double precision::numeric, 2);
