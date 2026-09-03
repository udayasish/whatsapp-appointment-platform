import { relations } from "drizzle-orm";
import { index, pgTable, uuid, varchar } from "drizzle-orm/pg-core";
import { commonFields } from "./common.js";
import { adminRoleEnum } from "./enums.js";
import { tenants } from "./tenants.js";

export const adminUsers = pgTable(
  "admin_users",
  {
    ...commonFields,
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    role: adminRoleEnum("role").notNull(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    status: varchar("status", { length: 20 }).notNull().default("active"),
  },
  (t) => [
    index("admin_users_email_idx").on(t.email),
    index("admin_users_tenant_id_idx").on(t.tenantId),
  ]
);

export const adminUsersRelations = relations(adminUsers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [adminUsers.tenantId],
    references: [tenants.id],
  }),
}));

export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;
