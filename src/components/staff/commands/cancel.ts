import { eq } from "drizzle-orm";
import { formatDateLong, formatTime12h } from "../../../common/format.js";
import { db, users } from "../../../lib/db/index.js";
import {
  cancelAppointment,
  findTodaysAppointmentByToken,
} from "../../appointments/services/index.js";
import { sendTextMessage } from "../../whatsapp/services/index.js";
import type { InboundMessageContext } from "../../whatsapp/services/message-router.js";
import { resolveDoctorScope } from "../resolve-doctor-scope.js";

export async function handleCancelCommand(
  ctx: InboundMessageContext,
  args: string
): Promise<string> {
  const [tokenStr = "", ...reasonParts] = args.trim().split(/\s+/);
  const token = Number(tokenStr);
  const reason = reasonParts.join(" ").trim();

  if (!Number.isInteger(token) || token <= 0 || reason.length === 0) {
    return "Usage: CANCEL <token number> <reason>";
  }

  const scope = await resolveDoctorScope(ctx);
  if (!scope.ok) return scope.message;

  const result = await findTodaysAppointmentByToken(ctx.tenant.id, token, scope.doctorId);
  if (result.ambiguousDoctorNames.length > 0) {
    return `Token #${token} matches multiple doctors today (${result.ambiguousDoctorNames.join(", ")}). Please ask the doctor to send this command themselves.`;
  }
  const appointment = result.appointment;
  if (!appointment) return `No booked appointment found for token #${token} today.`;

  await cancelAppointment(appointment.id, appointment.slotId, reason);

  const patient = await db.query.users.findFirst({ where: eq(users.id, appointment.patientId) });
  if (patient) {
    await sendTextMessage({
      tenantId: ctx.tenant.id,
      phoneNumberId: ctx.tenant.whatsappPhoneNumberId,
      to: patient.phoneNumber,
      body:
        `Your appointment (Token #${token}) on ${formatDateLong(appointment.appointmentDate)} ` +
        `at ${formatTime12h(appointment.appointmentTime)} has been cancelled.\nReason: ${reason}`,
    });
  }

  return `Token #${token} cancelled and patient notified.`;
}
