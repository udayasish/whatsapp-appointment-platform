import { relations } from "drizzle-orm";
import {
  date,
  index,
  pgTable,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { commonFields } from "./common.js";
import { blockedDateReasonEnum } from "./enums.js";
import { tenants } from "./tenants.js";
import { doctors } from "./doctors.js";

// A date a given doctor is unavailable (staff BLOCK command). Existing slots
// on that date are cancelled and affected patients notified.
export const blockedDates = pgTable(
  "blocked_dates",
  {
    ...commonFields,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id),
    blockedDate: date("blocked_date", { mode: "string" }).notNull(),
    reason: blockedDateReasonEnum("reason").notNull().default("other"),
    notes: varchar("notes", { length: 500 }),
  },
  (t) => [
    unique("blocked_dates_doctor_date_unique").on(t.doctorId, t.blockedDate),
    index("blocked_dates_tenant_id_idx").on(t.tenantId),
  ]
);

export const blockedDatesRelations = relations(blockedDates, ({ one }) => ({
  tenant: one(tenants, {
    fields: [blockedDates.tenantId],
    references: [tenants.id],
  }),
  doctor: one(doctors, {
    fields: [blockedDates.doctorId],
    references: [doctors.id],
  }),
}));

export type BlockedDate = typeof blockedDates.$inferSelect;
