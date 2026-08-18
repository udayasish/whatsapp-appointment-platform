import { and, eq, gte } from "drizzle-orm";
import { appointments, db, doctors, users } from "../../../lib/db/index.js";

export interface UpcomingAppointmentSummary {
  tokenNumber: number;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function listUpcomingAppointmentsForPatient(
  patientId: string
): Promise<UpcomingAppointmentSummary[]> {
  const rows = await db
    .select({
      tokenNumber: appointments.tokenNumber,
      doctorName: users.name,
      appointmentDate: appointments.appointmentDate,
      appointmentTime: appointments.appointmentTime,
    })
    .from(appointments)
    .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
    .innerJoin(users, eq(doctors.userId, users.id))
    .where(
      and(
        eq(appointments.patientId, patientId),
        eq(appointments.status, "booked"),
        gte(appointments.appointmentDate, todayDateString())
      )
    )
    .orderBy(appointments.appointmentDate, appointments.appointmentTime);

  return rows.map((r) => ({
    tokenNumber: r.tokenNumber,
    doctorName: r.doctorName ?? "Doctor",
    appointmentDate: r.appointmentDate,
    appointmentTime: r.appointmentTime,
  }));
}
