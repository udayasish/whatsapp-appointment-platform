import { and, eq } from "drizzle-orm";
import { appointments, db, doctors, users, type AppointmentStatus } from "../../../lib/db/index.js";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface TodaysAppointmentSummary {
  tokenNumber: number;
  doctorName: string;
  patientName: string;
  appointmentTime: string;
  status: AppointmentStatus;
}

/** If `doctorId` is omitted, returns today's appointments across every doctor in the tenant. */
export async function listTodaysAppointments(
  tenantId: string,
  doctorId?: string
): Promise<TodaysAppointmentSummary[]> {
  const conditions = [eq(appointments.tenantId, tenantId), eq(appointments.appointmentDate, todayDateString())];
  if (doctorId) conditions.push(eq(appointments.doctorId, doctorId));

  const rows = await db
    .select({
      tokenNumber: appointments.tokenNumber,
      doctorName: users.name,
      patientName: appointments.patientName,
      appointmentTime: appointments.appointmentTime,
      status: appointments.status,
    })
    .from(appointments)
    .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
    .innerJoin(users, eq(doctors.userId, users.id))
    .where(and(...conditions))
    .orderBy(appointments.appointmentTime);

  return rows.map((r) => ({ ...r, doctorName: r.doctorName ?? "Doctor" }));
}
