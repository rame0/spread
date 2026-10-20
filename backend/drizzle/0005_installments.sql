ALTER TABLE "cards" ADD COLUMN "kind" varchar(16) DEFAULT 'credit' NOT NULL;
--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "installment_count" integer;
--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "installment_interval" varchar(8);
--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "first_payment_date" date;
--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "installment_fee" real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "grace_buckets" ADD COLUMN "purchase_id" uuid REFERENCES "purchases"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "grace_buckets" ADD COLUMN "installment_number" integer;
--> statement-breakpoint
DROP INDEX "grace_buckets_card_period";
--> statement-breakpoint
CREATE UNIQUE INDEX "grace_buckets_card_period" ON "grace_buckets" USING btree ("card_id","period_start_date") WHERE "purchase_id" IS NULL;
--> statement-breakpoint
CREATE INDEX "grace_buckets_purchase_idx" ON "grace_buckets" USING btree ("purchase_id");
