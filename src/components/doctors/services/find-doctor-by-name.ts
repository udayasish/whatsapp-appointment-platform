import { and, eq, ilike } from "drizzle-orm";
import { db, doctors, users } from "../../../lib/db/index.js";

export interface DoctorMatch {
  id: string;
  name: string;
  isActive: boolean;
}

/**
 * Case-insensitive partial match on the doctor's name, scoped to the tenant.
 * Used by staff commands (BLOCK/SLOT) that identify a doctor by name rather
 * than id, since staff type free text on WhatsApp.
 */
export async function findDoctorsByName(
  tenantId: string,
  namePart: string
): Promise<DoctorMatch[]> {
  const rows = await db
    .select({ id: doctors.id, name: users.name, isActive: doctors.isActive })
    .from(doctors)
    .innerJoin(users, eq(doctors.userId, users.id))
    .where(and(eq(doctors.tenantId, tenantId), ilike(users.name, `%${namePart}%`)));

  return rows.map((r) => ({ id: r.id, name: r.name ?? "Doctor", isActive: r.isActive }));
}
