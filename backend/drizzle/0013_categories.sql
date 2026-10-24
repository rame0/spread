ALTER TABLE "users" ADD COLUMN "categories_seeded" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE "categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "name" varchar(64) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "categories_user_name" ON "categories" USING btree ("user_id", lower("name"));
--> statement-breakpoint
CREATE TABLE "category_reference_map" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "reference_category" varchar(64) NOT NULL,
  "category_id" uuid NOT NULL REFERENCES "categories"("id") ON DELETE cascade,
  PRIMARY KEY ("user_id", "reference_category")
);
--> statement-breakpoint
CREATE TABLE "category_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "pattern" varchar(512) NOT NULL,
  "category_id" uuid NOT NULL REFERENCES "categories"("id") ON DELETE cascade,
  "embedding" real[],
  "model_version" varchar(32),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "category_rules_user_pattern" ON "category_rules" USING btree ("user_id", "pattern");
--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "category_id" uuid REFERENCES "categories"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "category_source" varchar(8);
--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "category_margin" real;
--> statement-breakpoint
CREATE INDEX "purchases_category_idx" ON "purchases" USING btree ("category_id");
