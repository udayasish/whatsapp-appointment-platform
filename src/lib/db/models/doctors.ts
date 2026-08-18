import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { commonFields } from "./common.js";
import { tenants } from "./tenants.js";
import { users } from "./users.js";

// One doctor profile per user (role=doctor). Split from `users` because
// doctors carry scheduling attributes patients/receptionists never need.
export const doctors = pgTable(
  "doctors",
  {
    ...commonFields,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id)
      .unique(),
    specialization: varchar("specialization", { length: 255 }),
    consultationDurationMinutes: integer("consultation_duration_minutes")
      .notNull()
      .default(15),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("doctors_tenant_id_idx").on(t.tenantId)]
);

export const doctorsRelations = relations(doctors, ({ one }) => ({
  tenant: one(tenants, {
    fields: [doctors.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [doctors.userId],
    references: [users.id],
  }),
}));

export type Doctor = typeof doctors.$inferSelect;
