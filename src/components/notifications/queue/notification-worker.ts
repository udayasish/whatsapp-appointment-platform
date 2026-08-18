import { Worker } from "bullmq";
import { and, eq } from "drizzle-orm";
import { bullConnection, registerWorker } from "../../../lib/bull/index.js";
import type {
  BookingAlertJobData,
  MorningSummaryJobData,
  NotificationJobData,
} from "../../../lib/bull/queues.js";
import { appointments, db, doctors, tenants, users } from "../../../lib/db/index.js";
import { formatDateLong, formatTime12h } from "../../../common/format.js";
import { listActiveDoctors } from "../../doctors/services/index.js";
import { sendTemplateMessage } from "../../whatsapp/services/index.js";
import {
  buildDoctorDailySummaryComponents,
  buildDoctorNewBookingAlertComponents,
  TEMPLATE_LANGUAGE,
} from "../../whatsapp/templates.js";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

async function handleMorningSummary(data: MorningSummaryJobData): Promise<void> {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, data.tenantId) });
  if (!tenant || !tenant.notificationsEnabled) return;

  const activeDoctors = await listActiveDoctors(tenant.id);
  const today = todayDateString();

  for (const doctorSummary of activeDoctors) {
    const doctor = await db.query.doctors.findFirst({ where: eq(doctors.id, doctorSummary.id) });
    if (!doctor) continue;
    const doctorUser = await db.query.users.findFirst({ where: eq(users.id, doctor.userId) });
    if (!doctorUser) continue;

    const todaysAppointments = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, doctor.id),
          eq(appointments.appointmentDate, today),
          eq(appointments.status, "booked")
        )
      );

    const sorted = [...todaysAppointments].sort((a, b) =>
      a.appointmentTime.localeCompare(b.appointmentTime)
    );

    const appointmentsList =
      sorted.length === 0
        ? "You have no appointments scheduled today."
        : `You have ${sorted.length} appointment(s) today:\n` +
          sorted
            .map((a) => `#${a.tokenNumber} — ${a.patientName} at ${formatTime12h(a.appointmentTime)}`)
            .join("\n");

    await sendTemplateMessage({
      tenantId: tenant.id,
      phoneNumberId: tenant.whatsappPhoneNumberId,
      to: doctorUser.phoneNumber,
      templateName: "doctor_daily_summary",
      languageCode: TEMPLATE_LANGUAGE,
      components: buildDoctorDailySummaryComponents({
        doctorName: doctorUser.name ?? "",
        clinicName: tenant.name,
        todayDate: formatDateLong(today),
        appointmentsList,
      }),
    });
  }
}

async function handleBookingAlert(data: BookingAlertJobData): Promise<void> {
  const appointment = await db.query.appointments.findFirst({
    where: eq(appointments.id, data.appointmentId),
  });
  if (!appointment) return;

  const [doctor, tenant] = await Promise.all([
    db.query.doctors.findFirst({ where: eq(doctors.id, appointment.doctorId) }),
    db.query.tenants.findFirst({ where: eq(tenants.id, appointment.tenantId) }),
  ]);
  if (!doctor || !tenant || !tenant.notificationsEnabled) return;

  const doctorUser = await db.query.users.findFirst({ where: eq(users.id, doctor.userId) });
  if (!doctorUser) return;

  await sendTemplateMessage({
    tenantId: tenant.id,
    phoneNumberId: tenant.whatsappPhoneNumberId,
    to: doctorUser.phoneNumber,
    templateName: "doctor_new_booking_alert",
    languageCode: TEMPLATE_LANGUAGE,
    components: buildDoctorNewBookingAlertComponents({
      doctorName: doctorUser.name ?? "",
      clinicName: tenant.name,
      patientName: appointment.patientName,
      tokenNumber: String(appointment.tokenNumber),
      appointmentDate: formatDateLong(appointment.appointmentDate),
      appointmentTime: formatTime12h(appointment.appointmentTime),
      complaint: appointment.complaint ?? "N/A",
    }),
  });
}

const notificationWorker = new Worker<NotificationJobData>(
  "notification_queue",
  async (job) => {
    if (job.name === "morning-summary") {
      await handleMorningSummary(job.data as MorningSummaryJobData);
    } else if (job.name === "booking-alert") {
      await handleBookingAlert(job.data as BookingAlertJobData);
    }
  },
  { connection: bullConnection }
);

registerWorker(notificationWorker);
