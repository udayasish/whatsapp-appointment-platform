import { and, eq, sql } from "drizzle-orm";
import { appointments, db, slots, type Appointment } from "../../../lib/db/index.js";

export interface CreateAppointmentParams {
  tenantId: string;
  doctorId: string;
  patientId: string;
  slotId: string;
  appointmentDate: string;
  appointmentTime: string;
  patientName: string;
  patientAge: number;
  complaint: string;
}

/**
 * Books a slot and assigns a token number sequential per (doctor, date).
 * Wrapped in a transaction with a Postgres advisory lock scoped to
 * "doctorId:date" plus a row lock on the slot: two patients confirming the
 * same doctor/day concurrently must never get the same token, and the same
 * slot must never be double-booked. Returns null if the slot was already
 * taken by the time this ran (race with another booking).
 */
export async function createAppointmentFromBooking(
  params: CreateAppointmentParams
): Promise<Appointment | null> {
  return db.transaction(async (tx) => {
    const lockKey = `${params.doctorId}:${params.appointmentDate}`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);

    const [slot] = await tx
      .select()
      .from(slots)
      .where(eq(slots.id, params.slotId))
      .for("update");

    if (!slot || slot.status !== "available") {
      return null;
    }

    const [{ maxToken }] = await tx
      .select({
        maxToken: sql<number>`coalesce(max(${appointments.tokenNumber}), 0)`,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, params.doctorId),
          eq(appointments.appointmentDate, params.appointmentDate)
        )
      );

    const tokenNumber = Number(maxToken) + 1;

    await tx
      .update(slots)
      .set({ status: "booked" })
      .where(eq(slots.id, params.slotId));

    const [appointment] = await tx
      .insert(appointments)
      .values({
        tenantId: params.tenantId,
        doctorId: params.doctorId,
        patientId: params.patientId,
        slotId: params.slotId,
        tokenNumber,
        appointmentDate: params.appointmentDate,
        appointmentTime: params.appointmentTime,
        patientName: params.patientName,
        patientAge: params.patientAge,
        complaint: params.complaint,
      })
      .returning();

    return appointment ?? null;
  });
}
