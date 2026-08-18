import { parseWeekdays } from "../../../common/day-of-week.js";
import { env } from "../../../lib/index.js";
import { findDoctorsByName } from "../../doctors/services/index.js";
import { generateSlots } from "../../slots/services/index.js";
import type { InboundMessageContext } from "../../whatsapp/services/message-router.js";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export async function handleSlotCommand(
  ctx: InboundMessageContext,
  args: string
): Promise<string> {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 5) {
    return "Usage: SLOT <doctor name> <days e.g. MON,WED,FRI> <start HH:MM> <end HH:MM> <duration minutes>";
  }

  const n = parts.length;
  const durationStr = parts[n - 1]!;
  const endStr = parts[n - 2]!;
  const startStr = parts[n - 3]!;
  const daysStr = parts[n - 4]!;
  const doctorNamePart = parts.slice(0, n - 4).join(" ");

  if (!doctorNamePart) {
    return "Usage: SLOT <doctor name> <days e.g. MON,WED,FRI> <start HH:MM> <end HH:MM> <duration minutes>";
  }
  if (!TIME_RE.test(startStr) || !TIME_RE.test(endStr)) {
    return "Invalid time format. Use HH:MM (24-hour), e.g. 09:00.";
  }
  if (startStr >= endStr) {
    return "Start time must be before end time.";
  }
  const duration = Number(durationStr);
  if (!Number.isInteger(duration) || duration <= 0) {
    return "Invalid duration. Must be a positive whole number of minutes.";
  }
  const weekdays = parseWeekdays(daysStr);
  if (!weekdays) {
    return "Invalid days. Use comma-separated abbreviations: MON,TUE,WED,THU,FRI,SAT,SUN.";
  }

  const matches = await findDoctorsByName(ctx.tenant.id, doctorNamePart);
  if (matches.length === 0) return `No doctor found matching "${doctorNamePart}".`;
  if (matches.length > 1) {
    return `Multiple doctors match "${doctorNamePart}": ${matches.map((m) => m.name).join(", ")}. Please be more specific.`;
  }
  const doctor = matches[0]!;

  const created = await generateSlots({
    tenantId: ctx.tenant.id,
    doctorId: doctor.id,
    weekdays,
    startTime: startStr,
    endTime: endStr,
    durationMinutes: duration,
    horizonDays: env.BOOKING_HORIZON_DAYS,
  });

  return `Created ${created.length} new slot(s) for ${doctor.name} (${weekdays.join(", ")}, ${startStr}-${endStr}, ${duration} min each).`;
}
