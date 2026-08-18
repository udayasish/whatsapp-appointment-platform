import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { bullConnection, registerWorker } from "../../../lib/bull/index.js";
import type { ReminderJobData } from "../../../lib/bull/queues.js";
import { appointments, db, doctors, tenants, users } from "../../../lib/db/index.js";
import { formatDateLong, formatTime12h } from "../../../common/format.js";
import logger from "../../../lib/logger.js";
import { sendTemplateMessage } from "../../whatsapp/services/index.js";
import {
  buildAppointmentReminderComponents,
  TEMPLATE_LANGUAGE,
} from "../../whatsapp/templates.js";

const reminderWorker = new Worker<ReminderJobData>(
  "reminder_queue",
  async (job) => {
    const appointment = await db.query.appointments.findFirst({
      where: eq(appointments.id, job.data.appointmentId),
    });
    // Cancelled/completed in the meantime, or already reminded — nothing to do.
    if (!appointment || appointment.status !== "booked" || appointment.reminderSent) {
      return;
    }

    const [patient, doctor, tenant] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, appointment.patientId) }),
      db.query.doctors.findFirst({ where: eq(doctors.id, appointment.doctorId) }),
      db.query.tenants.findFirst({ where: eq(tenants.id, appointment.tenantId) }),
    ]);
    if (!patient || !tenant) {
      throw new Error(`Missing patient/tenant for appointment ${appointment.id}`);
    }
    if (!tenant.remindersEnabled) {
      logger.info("Skipping reminder — disabled for tenant", { tenantId: tenant.id });
      return;
    }
    const doctorUser = doctor
      ? await db.query.users.findFirst({ where: eq(users.id, doctor.userId) })
      : null;

    await sendTemplateMessage({
      tenantId: tenant.id,
      phoneNumberId: tenant.whatsappPhoneNumberId,
      to: patient.phoneNumber,
      templateName: "appointment_reminder",
      languageCode: TEMPLATE_LANGUAGE,
      components: buildAppointmentReminderComponents({
        patientName: appointment.patientName,
        clinicName: tenant.name,
        doctorName: doctorUser?.name ?? "the doctor",
        appointmentDate: formatDateLong(appointment.appointmentDate),
        appointmentTime: formatTime12h(appointment.appointmentTime),
        tokenNumber: String(appointment.tokenNumber),
      }),
    });

    await db
      .update(appointments)
      .set({ reminderSent: true })
      .where(eq(appointments.id, appointment.id));
  },
  { connection: bullConnection }
);

registerWorker(reminderWorker);
