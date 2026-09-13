import { and, eq } from "drizzle-orm";
import { formatDateLong } from "../../../common/format.js";
import { appointments, blockedDates, db, doctors, slots, tenants, users } from "../../../lib/db/index.js";
import type { BlockedDateReason } from "../../../lib/db/models/enums.js";
import { sendTextMessage } from "../../whatsapp/services/index.js";

export interface BlockDateParams {
  tenantId: string;
  doctorId: string;
  date: string;
  reason?: BlockedDateReason;
  notes?: string;
}

export interface BlockDateResult {
  blockedDate: typeof blockedDates.$inferSelect;
  affectedSlots: number;
  cancelledAppointments: number;
}

export async function blockDoctorDate(params: BlockDateParams): Promise<BlockDateResult> {
  const { tenantId, doctorId, date, reason = "leave", notes } = params;

  const [inserted] = await db
    .insert(blockedDates)
    .values({
      tenantId,
      doctorId,
      blockedDate: date,
      reason,
      notes: notes || null,
    })
    .onConflictDoNothing()
    .returning();

  if (!inserted) {
    throw new Error(`Date ${date} is already blocked for this doctor.`);
  }

  // Mark all slots on that date as 'blocked'
  const affectedSlots = await db
    .update(slots)
    .set({ status: "blocked" })
    .where(and(eq(slots.doctorId, doctorId), eq(slots.slotDate, date)))
    .returning();

  // Cancel any booked appointments on that date
  const affectedAppointments = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.doctorId, doctorId),
        eq(appointments.appointmentDate, date),
        eq(appointments.status, "booked")
      )
    );

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  const doctor = await db.query.doctors.findFirst({
    where: eq(doctors.id, doctorId),
    with: { user: true },
  });
  const doctorName = doctor?.user?.name || "Doctor";

  for (const appt of affectedAppointments) {
    await db
      .update(appointments)
      .set({
        status: "cancelled",
        cancelReason: `${doctorName} unavailable on this date`,
      })
      .where(eq(appointments.id, appt.id));

    if (tenant?.whatsappPhoneNumberId) {
      const patient = await db.query.users.findFirst({
        where: eq(users.id, appt.patientId),
      });
      if (patient?.phoneNumber) {
        try {
          await sendTextMessage({
            tenantId,
            phoneNumberId: tenant.whatsappPhoneNumberId,
            to: patient.phoneNumber,
            body:
              `Your appointment (Token #${appt.tokenNumber}) on ${formatDateLong(date)} has been cancelled — ` +
              `${doctorName} is unavailable that day. Please message us to rebook.`,
          });
        } catch (error) {
          console.error("Failed to send cancellation notification via WhatsApp:", error);
        }
      }
    }
  }

  return {
    blockedDate: inserted,
    affectedSlots: affectedSlots.length,
    cancelledAppointments: affectedAppointments.length,
  };
}

export async function unblockDoctorDate(params: {
  tenantId: string;
  doctorId: string;
  blockedDateId: string;
}): Promise<{ unblockedDate: string; reopenedSlots: number }> {
  const { tenantId, doctorId, blockedDateId } = params;

  const [existing] = await db
    .select()
    .from(blockedDates)
    .where(
      and(
        eq(blockedDates.id, blockedDateId),
        eq(blockedDates.doctorId, doctorId),
        eq(blockedDates.tenantId, tenantId)
      )
    );

  if (!existing) {
    throw new Error("Blocked date record not found.");
  }

  await db
    .delete(blockedDates)
    .where(eq(blockedDates.id, blockedDateId));

  // Re-open slots for that date that are currently 'blocked' back to 'available'
  const reopenedSlots = await db
    .update(slots)
    .set({ status: "available" })
    .where(
      and(
        eq(slots.doctorId, doctorId),
        eq(slots.slotDate, existing.blockedDate),
        eq(slots.status, "blocked")
      )
    )
    .returning();

  return {
    unblockedDate: existing.blockedDate,
    reopenedSlots: reopenedSlots.length,
  };
}
