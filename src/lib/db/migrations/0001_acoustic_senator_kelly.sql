ALTER TABLE "tenants" ADD COLUMN "reminders_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "notifications_enabled" boolean DEFAULT true NOT NULL;