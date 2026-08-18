import { zonedTimeToUtc } from "../../../common/timezone.js";
import { reminderQueue } from "../../../lib/bull/queues.js";
import logger from "../../../lib/logger.js";
import type { Appointment } from "../../../lib/db/index.js";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Schedules a reminder job to fire 24h before the appointment's wall-clock
 * time in the tenant's timezone. If that moment has already passed (the
 * booking itself happened inside the 24h window), the reminder is skipped
 * rather than firing immediately or in the past.
 */
export async function scheduleReminder(
  appointment: Appointment,
  tenantTimezone: string
): Promise<void> {
  const appointmentInstant = zonedTimeToUtc(
    appointment.appointmentDate,
    appointment.appointmentTime,
    tenantTimezone
  );
  const fireAt = appointmentInstant.getTime() - TWENTY_FOUR_HOURS_MS;
  const delay = fireAt - Date.now();

  if (delay <= 0) {
    logger.info("Skipping reminder — 24h-before window has already passed", {
      appointmentId: appointment.id,
    });
    return;
  }

  await reminderQueue.add("send-reminder", { appointmentId: appointment.id }, { delay });
}
