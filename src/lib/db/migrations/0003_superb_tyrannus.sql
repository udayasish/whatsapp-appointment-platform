ALTER TABLE "slots" ADD COLUMN "max_patients" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
CREATE INDEX "appointments_slot_id_status_idx" ON "appointments" USING btree ("slot_id","status");