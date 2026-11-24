CREATE TABLE "policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"request_id" uuid,
	"product" text NOT NULL,
	"insurer" text,
	"policy_no" text,
	"subject" text,
	"start_date" text,
	"end_date" text,
	"premium" numeric(12, 2),
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"request_id" uuid,
	"policy_id" uuid,
	"due_at" timestamp with time zone NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'manual' NOT NULL,
	"done_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "customer_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "policies_contact_idx" ON "policies" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "policies_end_idx" ON "policies" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "reminders_due_idx" ON "reminders" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "reminders_contact_idx" ON "reminders" USING btree ("contact_id");--> statement-breakpoint
-- Keep existing follow-ups: request.next_action_* becomes an alarm.
INSERT INTO "reminders" ("contact_id", "request_id", "due_at", "title", "kind", "created_by")
SELECT "contact_id", "id", "next_action_at", coalesce(nullif("next_action_note", ''), 'Takip'), 'manual', "assigned_to"
FROM "requests" WHERE "next_action_at" IS NOT NULL AND "stage" NOT IN ('won', 'lost');--> statement-breakpoint
-- Existing customers: customer since = first won request, else last update.
UPDATE "contacts" c SET "customer_since" = coalesce(
  (SELECT min("closed_at") FROM "requests" r WHERE r."contact_id" = c."id" AND r."stage" = 'won'), c."updated_at")
WHERE c."lifecycle" = 'customer';--> statement-breakpoint
ALTER TABLE "policies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reminders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "requests" DROP COLUMN "next_action_at";--> statement-breakpoint
ALTER TABLE "requests" DROP COLUMN "next_action_note";