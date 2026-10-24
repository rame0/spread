ALTER TABLE "plan_items" ADD COLUMN "category_id" uuid REFERENCES "categories"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "plan_items" ADD COLUMN "source_pattern" varchar(512);
--> statement-breakpoint
CREATE TABLE "plan_suggestion_dismissals" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "key" varchar(600) NOT NULL,
  "amount" numeric(16,2) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY ("user_id", "key")
);
