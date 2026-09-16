import { eq } from "drizzle-orm";
import { db, tenants } from "../../../lib/db/index.js";
import { getOrCreatePatient } from "../../booking/services/get-or-create-patient.js";
import { createAppointmentFromBooking } from "../../appointments/services/create-appointment.js";
import { listAvailableSlots } from "../../slots/services/list-available-slots.js";
import { scheduleReminder } from "../../appointments/queue/index.js";
import { scheduleBookingAlert } from "../../notifications/queue/index.js";
import { sendBookingConfirmationSms } from "./sms.service.js";
import { logger } from "../../../lib/index.js";
import type { IvrSession } from "./session.service.js";

export interface BookingResultSuccess {
  success: true;
  tokenNumber: number;
  appointmentId: string;
}

export interface BookingResultSlotTaken {
  success: false;
  reason: "slot_taken";
  freshSlots: { id: string; startTime: string; endTime: string }[];
}

export type IvrBookingResult = BookingResultSuccess | BookingResultSlotTaken;

/**
 * Handles the complete appointment confirmation transaction for an IVR call:
 * 1. Resolves or creates patient user record
 * 2. Creates the appointment using the advisory lock-protected transaction
 * 3. Handles slot conflict race conditions
 * 4. Schedules reminders, staff alerts, and SMS confirmation
 */
export async function executeIvrBooking(session: IvrSession): Promise<IvrBookingResult> {
  const patient = await getOrCreatePatient(
    session.tenantId,
    session.callerPhone,
    null
  );

  const appointment = await createAppointmentFromBooking({
    tenantId: session.tenantId,
    doctorId: session.selectedDoctorId!,
    patientId: patient.id,
    slotId: session.selectedSlotId!,
    appointmentDate: session.selectedDate!,
    appointmentTime: session.selectedSlotTime!,
    patientName: patient.name || "Phone Caller",
    patientAge: 30,
    complaint: "Booked via IVR",
  });

  if (!appointment) {
    const freshSlots = await listAvailableSlots(
      session.selectedDoctorId!,
      session.selectedDate!
    );
    return {
      success: false,
      reason: "slot_taken",
      freshSlots: freshSlots.map((s) => ({
        id: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
    };
  }

  // Non-blocking notifications (each guarded with try/catch)
  try {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, session.tenantId))
      .limit(1);

    if (tenant) {
      await scheduleReminder(appointment, tenant.timezone);
    }
  } catch (reminderErr) {
    logger.error("Failed to schedule IVR appointment reminder", {
      err: reminderErr,
      appointmentId: appointment.id,
    });
  }

  try {
    await scheduleBookingAlert(appointment.id);
  } catch (alertErr) {
    logger.error("Failed to schedule IVR booking alert", {
      err: alertErr,
      appointmentId: appointment.id,
    });
  }

  try {
    await sendBookingConfirmationSms(
      session.callerPhone,
      session.selectedDoctorName!,
      session.selectedDate!,
      session.selectedSlotTime!,
      appointment.tokenNumber
    );
  } catch (smsErr) {
    logger.error("Failed to send IVR booking confirmation SMS", {
      err: smsErr,
      appointmentId: appointment.id,
    });
  }

  return {
    success: true,
    tokenNumber: appointment.tokenNumber,
    appointmentId: appointment.id,
  };
}
