import { and, eq } from "drizzle-orm";
import { appointments, db, doctors, users, type Appointment } from "../../../lib/db/index.js";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface TokenLookupResult {
  appointment: Appointment | null;
  /** Non-empty when the token matches more than one doctor's queue today. */
  ambiguousDoctorNames: string[];
}

/**
 * Token numbers are sequential per doctor per day, so the same number can
 * exist under several doctors on the same date. `restrictDoctorId` (used when
 * a doctor themself sends the command) disambiguates; otherwise an ambiguous
 * match is reported rather than silently acting on the wrong appointment.
 */
export async function findTodaysAppointmentByToken(
  tenantId: string,
  token: number,
  restrictDoctorId?: string
): Promise<TokenLookupResult> {
  const conditions = [
    eq(appointments.tenantId, tenantId),
    eq(appointments.appointmentDate, todayDateString()),
    eq(appointments.tokenNumber, token),
    eq(appointments.status, "booked"),
  ];
  if (restrictDoctorId) conditions.push(eq(appointments.doctorId, restrictDoctorId));

  const rows = await db
    .select({ appointment: appointments, doctorName: users.name })
    .from(appointments)
    .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
    .innerJoin(users, eq(doctors.userId, users.id))
    .where(and(...conditions));

  if (rows.length === 0) return { appointment: null, ambiguousDoctorNames: [] };
  if (rows.length > 1) {
    return { appointment: null, ambiguousDoctorNames: rows.map((r) => r.doctorName ?? "Doctor") };
  }
  return { appointment: rows[0]!.appointment, ambiguousDoctorNames: [] };
}
