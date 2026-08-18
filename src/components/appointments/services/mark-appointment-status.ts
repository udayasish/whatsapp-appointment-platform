import { eq } from "drizzle-orm";
import { appointments, db, slots } from "../../../lib/db/index.js";

export async function markAppointmentDone(appointmentId: string): Promise<void> {
  await db.update(appointments).set({ status: "completed" }).where(eq(appointments.id, appointmentId));
}

export async function markAppointmentNoShow(appointmentId: string): Promise<void> {
  await db.update(appointments).set({ status: "noshow" }).where(eq(appointments.id, appointmentId));
}

/** Cancels the appointment and frees its slot back up for rebooking. */
export async function cancelAppointment(
  appointmentId: string,
  slotId: string,
  reason: string
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(appointments)
      .set({ status: "cancelled", cancelReason: reason })
      .where(eq(appointments.id, appointmentId));
    await tx.update(slots).set({ status: "available" }).where(eq(slots.id, slotId));
  });
}
