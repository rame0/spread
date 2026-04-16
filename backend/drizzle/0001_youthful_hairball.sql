ALTER TABLE "cards" ADD COLUMN "grace_model" varchar(32) DEFAULT 'legacy_months' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "grace_statement_periods" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "payment_due_offset_days" integer DEFAULT 0 NOT NULL;