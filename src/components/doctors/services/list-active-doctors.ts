import { and, eq } from "drizzle-orm";
import { db, doctors, users } from "../../../lib/db/index.js";

export interface ActiveDoctorSummary {
  id: string;
  name: string;
  specialization: string | null;
}

export async function listActiveDoctors(
  tenantId: string
): Promise<ActiveDoctorSummary[]> {
  const rows = await db
    .select({
      id: doctors.id,
      name: users.name,
      specialization: doctors.specialization,
    })
    .from(doctors)
    .innerJoin(users, eq(doctors.userId, users.id))
    .where(and(eq(doctors.tenantId, tenantId), eq(doctors.isActive, true)))
    .orderBy(users.name);

  return rows.map((r) => ({
    id: r.id,
    name: r.name ?? "Doctor",
    specialization: r.specialization,
  }));
}
