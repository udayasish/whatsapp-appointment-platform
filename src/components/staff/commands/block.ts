import { and, eq } from "drizzle-orm";
import { formatDateLong } from "../../../common/format.js";
import { appointments, blockedDates, db, slots, users } from "../../../lib/db/index.js";
import { findDoctorsByName } from "../../doctors/services/index.js";
import { sendTextMessage } from "../../whatsapp/services/index.js";
import type { InboundMessageContext } from "../../whatsapp/services/message-router.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(dateStr: string): boolean {
  return !Number.isNaN(new Date(`${dateStr}T00:00:00Z`).getTime());
}

export async function handleBlockCommand(
  ctx: InboundMessageContext,
  args: string
): Promise<string> {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return "Usage: BLOCK <doctor name> <date YYYY-MM-DD>";
  }

  const dateStr = parts[parts.length - 1]!;
  const doctorNamePart = parts.slice(0, -1).join(" ");

  if (!DATE_RE.test(dateStr) || !isValidCalendarDate(dateStr)) {
    return "Invalid date. Usage: BLOCK <doctor name> <date YYYY-MM-DD>";
  }

  const matches = await findDoctorsByName(ctx.tenant.id, doctorNamePart);
  if (matches.length === 0) return `No doctor found matching "${doctorNamePart}".`;
  if (matches.length > 1) {
    return `Multiple doctors match "${doctorNamePart}": ${matches.map((m) => m.name).join(", ")}. Please be more specific.`;
  }
  const doctor = matches[0]!;

  const [inserted] = await db
    .insert(blockedDates)
    .values({ tenantId: ctx.tenant.id, doctorId: doctor.id, blockedDate: dateStr, reason: "other" })
    .onConflictDoNothing()
    .returning();

  if (!inserted) return `${doctor.name} is already blocked on ${dateStr}.`;

  const affectedSlots = await db
    .select()
    .from(slots)
    .where(and(eq(slots.doctorId, doctor.id), eq(slots.slotDate, dateStr)));

  if (affectedSlots.length > 0) {
    await db
      .update(slots)
      .set({ status: "blocked" })
      .where(and(eq(slots.doctorId, doctor.id), eq(slots.slotDate, dateStr)));
  }

  const affectedAppointments = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.doctorId, doctor.id),
        eq(appointments.appointmentDate, dateStr),
        eq(appointments.status, "booked")
      )
    );

  for (const appt of affectedAppointments) {
    await db
      .update(appointments)
      .set({ status: "cancelled", cancelReason: `${doctor.name} unavailable on this date` })
      .where(eq(appointments.id, appt.id));

    const patient = await db.query.users.findFirst({ where: eq(users.id, appt.patientId) });
    if (patient) {
      await sendTextMessage({
        tenantId: ctx.tenant.id,
        phoneNumberId: ctx.tenant.whatsappPhoneNumberId,
        to: patient.phoneNumber,
        body:
          `Your appointment (Token #${appt.tokenNumber}) on ${formatDateLong(dateStr)} has been cancelled — ` +
          `${doctor.name} is unavailable that day. Please message us to rebook.`,
      });
    }
  }

  return `${doctor.name} blocked on ${dateStr}. ${affectedSlots.length} slot(s) removed, ${affectedAppointments.length} patient(s) notified.`;
}
