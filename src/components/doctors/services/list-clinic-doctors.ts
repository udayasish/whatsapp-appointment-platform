import { and, eq } from "drizzle-orm";
import { db, doctors, users } from "../../../lib/db/index.js";

export interface ClinicDoctorItem {
  id: string;
  userId: string;
  name: string;
  initials: string;
  specialty: string;
  consultationDurationMinutes: number;
  isActive: boolean;
  phoneNumber?: string;
}

function computeInitials(name: string): string {
  if (!name) return "DR";
  // Remove prefixes like "Dr.", "Dr ", "Doctor "
  const cleaned = name.replace(/^(dr\.|dr|doctor)\s+/i, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (name.slice(0, 2) || "DR").toUpperCase();
}

/**
 * Lists all doctors for a specific clinic (both active and off-duty)
 * for the clinic admin web dashboard.
 */
export async function listClinicDoctors(
  tenantId: string
): Promise<ClinicDoctorItem[]> {
  const rows = await db
    .select({
      id: doctors.id,
      userId: doctors.userId,
      name: users.name,
      phoneNumber: users.phoneNumber,
      specialization: doctors.specialization,
      consultationDurationMinutes: doctors.consultationDurationMinutes,
      isActive: doctors.isActive,
    })
    .from(doctors)
    .innerJoin(users, eq(doctors.userId, users.id))
    .where(eq(doctors.tenantId, tenantId))
    .orderBy(users.name);

  return rows.map((r) => {
    const doctorName = r.name ?? "Doctor";
    return {
      id: r.id,
      userId: r.userId,
      name: doctorName,
      initials: computeInitials(doctorName),
      specialty: r.specialization || "General Physician",
      consultationDurationMinutes: r.consultationDurationMinutes || 15,
      isActive: r.isActive,
      phoneNumber: r.phoneNumber ? `+${r.phoneNumber}` : undefined,
    };
  });
}
