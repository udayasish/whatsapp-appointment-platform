import { relations } from "drizzle-orm";
import { index, pgTable, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { commonFields } from "./common.js";
import { userRoleEnum } from "./enums.js";
import { tenants } from "./tenants.js";

// People identified by WhatsApp phone number, scoped per tenant. NOT login
// accounts — this product has no dashboard, WhatsApp is the only interface.
// The same phone number can exist under different tenants with different
// roles (e.g. a receptionist at one clinic who is a patient at another).
export const users = pgTable(
  "users",
  {
    ...commonFields,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
    role: userRoleEnum("role").notNull(),
    name: varchar("name", { length: 255 }),
    languagePreference: varchar("language_preference", { length: 10 }).default(
      "en"
    ),
  },
  (t) => [
    unique("users_tenant_phone_unique").on(t.tenantId, t.phoneNumber),
    index("users_tenant_id_idx").on(t.tenantId),
    index("users_phone_number_idx").on(t.phoneNumber),
  ]
);

export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
}));

export type User = typeof users.$inferSelect;
