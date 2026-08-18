import { and, eq } from "drizzle-orm";
import { db, users, type User } from "../../../lib/db/index.js";

/**
 * Anyone messaging who isn't already a known doctor/receptionist/patient is a
 * prospective patient — the booking bot registers them on first contact
 * rather than requiring a separate signup step.
 */
export async function getOrCreatePatient(
  tenantId: string,
  phoneNumber: string,
  existingUser: User | null
): Promise<User> {
  if (existingUser) return existingUser;

  const [created] = await db
    .insert(users)
    .values({ tenantId, phoneNumber, role: "patient" })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const row = await db.query.users.findFirst({
    where: and(eq(users.tenantId, tenantId), eq(users.phoneNumber, phoneNumber)),
  });
  if (!row) throw new Error("Failed to get or create patient user");
  return row;
}
