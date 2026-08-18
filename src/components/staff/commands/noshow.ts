import {
  findTodaysAppointmentByToken,
  markAppointmentNoShow,
} from "../../appointments/services/index.js";
import type { InboundMessageContext } from "../../whatsapp/services/message-router.js";
import { resolveDoctorScope } from "../resolve-doctor-scope.js";

export async function handleNoshowCommand(
  ctx: InboundMessageContext,
  args: string
): Promise<string> {
  const token = Number(args.trim());
  if (!Number.isInteger(token) || token <= 0) {
    return "Usage: NOSHOW <token number>";
  }

  const scope = await resolveDoctorScope(ctx);
  if (!scope.ok) return scope.message;

  const result = await findTodaysAppointmentByToken(ctx.tenant.id, token, scope.doctorId);
  if (result.ambiguousDoctorNames.length > 0) {
    return `Token #${token} matches multiple doctors today (${result.ambiguousDoctorNames.join(", ")}). Please ask the doctor to send this command themselves.`;
  }
  if (!result.appointment) return `No booked appointment found for token #${token} today.`;

  await markAppointmentNoShow(result.appointment.id);
  return `Token #${token} marked as no-show.`;
}
