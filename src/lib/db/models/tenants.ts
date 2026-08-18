import { relations } from "drizzle-orm";
import { boolean, pgTable, varchar } from "drizzle-orm/pg-core";
import { commonFields } from "./common.js";
import { tenantStatusEnum } from "./enums.js";
import { users } from "./users.js";
import { doctors } from "./doctors.js";
import { appointments } from "./appointments.js";

// The tenant: one clinic, identified by the Meta WhatsApp phone number that
// receives its patients'/staff's messages.
export const tenants = pgTable("tenants", {
  ...commonFields,
  name: varchar("name", { length: 255 }).notNull(),
  whatsappPhoneNumberId: varchar("whatsapp_phone_number_id", { length: 64 })
    .notNull()
    .unique(),
  whatsappDisplayNumber: varchar("whatsapp_display_number", { length: 20 })
    .notNull()
    .unique(),
  status: tenantStatusEnum("status").notNull().default("active"),
  timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Kolkata"),
  // Per-tenant kill switches for proactive (out-of-session) WhatsApp template
  // sends — checked at send time in the queue workers, not at enqueue time,
  // so toggling takes effect immediately even for already-scheduled jobs.
  remindersEnabled: boolean("reminders_enabled").notNull().default(true),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
});

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  doctors: many(doctors),
  appointments: many(appointments),
}));

export type Tenant = typeof tenants.$inferSelect;
