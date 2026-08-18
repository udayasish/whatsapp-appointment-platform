import { notificationQueue } from "../../../lib/bull/queues.js";

/** Enqueues a real-time booking alert to the doctor. Called right after an appointment is created. */
export async function scheduleBookingAlert(appointmentId: string): Promise<void> {
  await notificationQueue.add("booking-alert", { appointmentId });
}
