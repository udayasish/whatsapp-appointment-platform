import { and, eq } from "drizzle-orm";
import { db, users, type User, type UserRole } from "../../../lib/db/index.js";

export type ResolvedSender =
  | { role: UserRole; user: User }
  | { role: "unknown"; user: null };

/** Resolves the sender's role by (tenant_id, phone_number). */
export async function resolveSenderRole(
  tenantId: string,
  phoneNumber: string
): Promise<ResolvedSender> {
  const user = await db.query.users.findFirst({
    where: and(eq(users.tenantId, tenantId), eq(users.phoneNumber, phoneNumber)),
  });
  if (!user) return { role: "unknown", user: null };
  return { role: user.role, user };
}
