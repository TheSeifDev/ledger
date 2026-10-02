CREATE TYPE "public"."transaction_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('PAYMENT', 'WITHDRAWAL');--> statement-breakpoint
CREATE TABLE "transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"type" "transaction_type" NOT NULL,
	"amount_minor_units" bigint NOT NULL,
	"paid_to" text,
	"notes" text,
	"evidence_key" text,
	"status" "transaction_status" DEFAULT 'PENDING' NOT NULL,
	"approved_by_user_id" text,
	"approved_at" timestamp with time zone,
	"rejected_by_user_id" text,
	"rejected_at" timestamp with time zone,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_amount_positive" CHECK ("transaction"."amount_minor_units" > 0),
	CONSTRAINT "transaction_notes_max_length" CHECK ("transaction"."notes" is null or char_length("transaction"."notes") <= 255)
);
--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_approved_by_user_id_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_rejected_by_user_id_user_id_fk" FOREIGN KEY ("rejected_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_org_id_unique" ON "project" USING btree ("organization_id","id");--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_org_project_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."project"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_org_actor_idem_unique" ON "transaction" USING btree ("organization_id","created_by_user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "transaction_project_created_idx" ON "transaction" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "transaction_organization_id_idx" ON "transaction" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "transaction_created_by_user_id_idx" ON "transaction" USING btree ("created_by_user_id");
