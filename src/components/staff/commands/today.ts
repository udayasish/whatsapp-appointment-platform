import { formatTime12h } from "../../../common/format.js";
import { listTodaysAppointments } from "../../appointments/services/index.js";
import type { InboundMessageContext } from "../../whatsapp/services/message-router.js";
import { resolveDoctorScope } from "../resolve-doctor-scope.js";

export async function handleTodayCommand(ctx: InboundMessageContext): Promise<string> {
  const scope = await resolveDoctorScope(ctx);
  if (!scope.ok) return scope.message;

  const list = await listTodaysAppointments(ctx.tenant.id, scope.doctorId);
  if (list.length === 0) return "No appointments scheduled for today.";

  return (
    `Today's appointments (${list.length}):\n` +
    list
      .map(
        (a) =>
          `#${a.tokenNumber} ${a.doctorName} — ${a.patientName} at ${formatTime12h(a.appointmentTime)} [${a.status.toUpperCase()}]`
      )
      .join("\n")
  );
}
