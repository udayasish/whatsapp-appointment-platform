// src/components/admin/services/get-admin-by-id.ts
import { eq } from "drizzle-orm";
import { db, adminUsers } from "../../../lib/db/index.js";
import type { AdminUser } from "../../../lib/db/models/admin-users.js";

/**
 * Fetches an admin user by their UUID.
 * Returns null if not found or if status is not 'active'.
 */
export const getAdminById = async (
  id: string
): Promise<Omit<AdminUser, "passwordHash"> | null> => {
  const results = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      name: adminUsers.name,
      role: adminUsers.role,
      tenantId: adminUsers.tenantId,
      status: adminUsers.status,
      createdAt: adminUsers.createdAt,
      updatedAt: adminUsers.updatedAt,
    })
    .from(adminUsers)
    .where(eq(adminUsers.id, id))
    .limit(1);

  const user = results[0];
  if (!user || user.status !== "active") return null;

  return user;
};
