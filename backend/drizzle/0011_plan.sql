CREATE TABLE "plan_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "name" varchar(255) NOT NULL,
  "kind" varchar(16) NOT NULL,
  "amount" numeric(16,2) NOT NULL,
  "currency" varchar(3) DEFAULT 'RUB' NOT NULL,
  "frequency" varchar(16) NOT NULL,
  "interval" integer DEFAULT 1 NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date,
  "spread" boolean DEFAULT false NOT NULL,
  "card_id" uuid REFERENCES "cards"("id") ON DELETE set null,
  "target_account_id" uuid REFERENCES "accounts"("id") ON DELETE set null,
  "note" varchar(512),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "plan_items_user_idx" ON "plan_items" USING btree ("user_id");
