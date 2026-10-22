ALTER TABLE "cards" ADD COLUMN "min_payment_percent" numeric(8,4);
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "min_payment_minimum" numeric(16,2);
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "payoff_strategy" varchar(16) DEFAULT 'latest' NOT NULL;
--> statement-breakpoint
UPDATE "cards" SET "min_payment_percent" = 4, "min_payment_minimum" = 400 WHERE "kind" = 'credit' AND "grace_model" = 'ozon_anchor';
--> statement-breakpoint
UPDATE "cards" SET "min_payment_percent" = 10, "min_payment_minimum" = 150 WHERE "kind" = 'credit' AND "grace_model" <> 'ozon_anchor';
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "is_card_reserve" boolean DEFAULT false NOT NULL;
