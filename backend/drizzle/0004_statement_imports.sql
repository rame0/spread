CREATE TABLE IF NOT EXISTS "statement_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"bank" varchar(32) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_hash" varchar(64) NOT NULL,
	"period_start" date,
	"period_end" date,
	"actual_debt" real,
	"reconciliation_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "statement_imports_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "statement_imports_reconciliation_id_balance_reconciliations_id_fk" FOREIGN KEY ("reconciliation_id") REFERENCES "public"."balance_reconciliations"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "statement_imports_card_hash" ON "statement_imports" USING btree ("card_id","file_hash");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "statement_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"statement_import_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"source_id" varchar(128),
	"operation_date" date NOT NULL,
	"operation_time" varchar(8),
	"kind" varchar(16) NOT NULL,
	"amount" real NOT NULL,
	"description" varchar(512),
	"purchase_id" uuid,
	"deposit_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "statement_operations_statement_import_id_statement_imports_id_fk" FOREIGN KEY ("statement_import_id") REFERENCES "public"."statement_imports"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "statement_operations_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "statement_operations_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "statement_operations_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "statement_operations_card_fingerprint" ON "statement_operations" USING btree ("card_id","fingerprint");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "statement_operations_import_idx" ON "statement_operations" USING btree ("statement_import_id");
