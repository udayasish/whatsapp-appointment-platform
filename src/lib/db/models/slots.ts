import { relations } from "drizzle-orm";
import {
  date,
  index,
  pgTable,
  time,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { commonFields } from "./common.js";
import { dayOfWeekEnum, slotStatusEnum } from "./enums.js";
import { tenants } from "./tenants.js";
import { doctors } from "./doctors.js";

// A single concrete bookable slot (one doctor, one date, one start time) —
// generated in bulk by the staff SLOT command, never a recurring template.
export const slots = pgTable(
  "slots",
  {
    ...commonFields,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id),
    slotDate: date("slot_date", { mode: "string" }).notNull(),
    dayOfWeek: dayOfWeekEnum("day_of_week").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    status: slotStatusEnum("status").notNull().default("available"),
  },
  (t) => [
    unique("slots_doctor_date_start_unique").on(
      t.doctorId,
      t.slotDate,
      t.startTime
    ),
    index("slots_tenant_id_idx").on(t.tenantId),
    index("slots_status_idx").on(t.status),
    index("slots_slot_date_idx").on(t.slotDate),
  ]
);

export const slotsRelations = relations(slots, ({ one }) => ({
  tenant: one(tenants, {
    fields: [slots.tenantId],
    references: [tenants.id],
  }),
  doctor: one(doctors, {
    fields: [slots.doctorId],
    references: [doctors.id],
  }),
}));

export type Slot = typeof slots.$inferSelect;
