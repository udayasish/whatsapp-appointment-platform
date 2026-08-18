import { formatDateLong, formatTime12h } from "../../../common/format.js";
import { createAppointmentFromBooking } from "../../appointments/services/index.js";
import { scheduleReminder } from "../../appointments/queue/index.js";
import { scheduleBookingAlert } from "../../notifications/queue/index.js";
import { t } from "../messages.js";
import type { StepContext, StepResult } from "../types.js";
import { confirmButtons, invalidReply } from "./shared.js";

export async function handleConfirmBooking(ctx: StepContext): Promise<StepResult> {
  const { lang, tempData, body, tenant, patient } = ctx;
  const choice = body.trim().toLowerCase();

  if (choice !== "yes" && choice !== "confirm" && choice !== "1") {
    return {
      nextStep: "confirm_booking",
      tempData,
      reply: invalidReply(lang, tempData),
      buttons: confirmButtons(lang),
    };
  }

  const appointment = await createAppointmentFromBooking({
    tenantId: tenant.id,
    doctorId: tempData.doctorId!,
    patientId: patient.id,
    slotId: tempData.slotId!,
    appointmentDate: tempData.date!,
    appointmentTime: tempData.slotStartTime!,
    patientName: tempData.patientName!,
    patientAge: tempData.patientAge!,
    complaint: tempData.complaint!,
  });

  if (!appointment) {
    return { nextStep: "idle", tempData: {}, reply: t(lang, "bookingFailedSlotTaken") };
  }

  await Promise.all([
    scheduleReminder(appointment, tenant.timezone),
    scheduleBookingAlert(appointment.id),
  ]);

  const reply = t(lang, "bookingSuccess", {
    token: appointment.tokenNumber,
    doctorName: tempData.doctorName!,
    date: formatDateLong(appointment.appointmentDate),
    time: formatTime12h(appointment.appointmentTime),
  });

  return { nextStep: "idle", tempData: {}, reply };
}
