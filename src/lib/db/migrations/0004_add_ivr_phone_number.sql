ALTER TABLE "tenants" ADD COLUMN "ivr_phone_number" varchar(20);--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_ivr_phone_number_unique" UNIQUE("ivr_phone_number");
