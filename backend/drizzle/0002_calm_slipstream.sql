DROP INDEX "grace_buckets_card_period";--> statement-breakpoint
ALTER TABLE "grace_buckets" ADD COLUMN "period_start_date" date;--> statement-breakpoint
UPDATE "grace_buckets"
SET "period_start_date" = make_date("period_year", "period_month", 1)
WHERE "period_start_date" IS NULL;--> statement-breakpoint
ALTER TABLE "grace_buckets" ALTER COLUMN "period_start_date" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "grace_buckets_card_period" ON "grace_buckets" USING btree ("card_id","period_start_date");
