DROP INDEX "contacts_phone_uq";--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "kind" text DEFAULT 'bireysel' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "contact_person" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "contact_title" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "tax_no" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "tax_office" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "sector" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "employee_count" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "address" text;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_kind_phone_uq" ON "contacts" USING btree ("kind","phone");--> statement-breakpoint
-- People whose requests were corporate (site "İşletmemi", kurumsal segment) become corporate profiles.
UPDATE "contacts" c SET "kind" = 'kurumsal', "contact_person" = c."full_name"
WHERE EXISTS (SELECT 1 FROM "requests" r WHERE r."contact_id" = c."id" AND r."segment" = 'kurumsal');
