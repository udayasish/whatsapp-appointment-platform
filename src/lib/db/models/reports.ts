import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { commonFields } from "./common.js";
import { reportStatusEnum } from "./enums.js";
import { tenants } from "./tenants.js";
import { users } from "./users.js";
import { appointments } from "./appointments.js";

export const reports = pgTable(
  "reports",
  {
    ...commonFields,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    // WhatsApp media id (or storage URL) of the source PDF.
    fileUrl: varchar("file_url", { length: 1000 }).notNull(),
    caption: varchar("caption", { length: 500 }),
    status: reportStatusEnum("status").notNull().default("pending"),
    retryCount: integer("retry_count").notNull().default(0),
  },
  (t) => [
    index("reports_tenant_id_idx").on(t.tenantId),
    index("reports_status_idx").on(t.status),
  ]
);

export const reportsRelations = relations(reports, ({ one }) => ({
  tenant: one(tenants, {
    fields: [reports.tenantId],
    references: [tenants.id],
  }),
  patient: one(users, {
    fields: [reports.patientId],
    references: [users.id],
  }),
  appointment: one(appointments, {
    fields: [reports.appointmentId],
    references: [appointments.id],
  }),
}));

export type Report = typeof reports.$inferSelect;
