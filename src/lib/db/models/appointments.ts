import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  time,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { commonFields } from "./common.js";
import { appointmentStatusEnum } from "./enums.js";
import { tenants } from "./tenants.js";
import { doctors } from "./doctors.js";
import { users } from "./users.js";
import { slots } from "./slots.js";

export const appointments = pgTable(
  "appointments",
  {
    ...commonFields,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => slots.id),
    // Sequential per doctor per day — what patients are told to look out for.
    tokenNumber: integer("token_number").notNull(),
    appointmentDate: date("appointment_date", { mode: "string" }).notNull(),
    appointmentTime: time("appointment_time").notNull(),
    patientName: varchar("patient_name", { length: 255 }).notNull(),
    patientAge: integer("patient_age").notNull(),
    complaint: text("complaint"),
    status: appointmentStatusEnum("status").notNull().default("booked"),
    cancelReason: varchar("cancel_reason", { length: 500 }),
    reminderSent: boolean("reminder_sent").notNull().default(false),
  },
  (t) => [
    unique("appointments_doctor_date_token_unique").on(
      t.doctorId,
      t.appointmentDate,
      t.tokenNumber
    ),
    index("appointments_tenant_id_idx").on(t.tenantId),
    index("appointments_appointment_date_idx").on(t.appointmentDate),
    index("appointments_status_idx").on(t.status),
  ]
);

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [appointments.tenantId],
    references: [tenants.id],
  }),
  doctor: one(doctors, {
    fields: [appointments.doctorId],
    references: [doctors.id],
  }),
  patient: one(users, {
    fields: [appointments.patientId],
    references: [users.id],
  }),
  slot: one(slots, {
    fields: [appointments.slotId],
    references: [slots.id],
  }),
}));

export type Appointment = typeof appointments.$inferSelect;
