import { db, slots } from "../../../lib/db/index.js";
import type { DayOfWeek } from "../../../lib/db/models/enums.js";

const JS_DAY_TO_ENUM: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export interface GenerateSlotsParams {
  tenantId: string;
  doctorId: string;
  weekdays: DayOfWeek[];
  /** "HH:mm" */
  startTime: string;
  /** "HH:mm" */
  endTime: string;
  durationMinutes: number;
  horizonDays: number;
}

/**
 * Expands a recurring weekly template (weekdays + time window + slot
 * duration) into concrete per-date slot rows over the next `horizonDays`
 * days. Used by the seed script and the staff SLOT command. Duplicate
 * (doctor, date, start_time) rows are silently skipped so re-running is safe.
 */
export async function generateSlots(params: GenerateSlotsParams) {
  const {
    tenantId,
    doctorId,
    weekdays,
    startTime,
    endTime,
    durationMinutes,
    horizonDays,
  } = params;
  const weekdaySet = new Set(weekdays);
  const rows: (typeof slots.$inferInsert)[] = [];

  const today = new Date();
  for (let offset = 0; offset < horizonDays; offset++) {
    const date = new Date(today);
    date.setDate(date.getDate() + offset);
    const dayOfWeek = JS_DAY_TO_ENUM[date.getDay()]!;
    if (!weekdaySet.has(dayOfWeek)) continue;

    const slotDate = toDateString(date);
    let cursor = startTime;
    while (cursor < endTime) {
      const slotEnd = addMinutes(cursor, durationMinutes);
      if (slotEnd > endTime) break; // never create a partial trailing slot
      rows.push({ tenantId, doctorId, slotDate, dayOfWeek, startTime: cursor, endTime: slotEnd });
      cursor = slotEnd;
    }
  }

  if (rows.length === 0) return [];

  return db.insert(slots).values(rows).onConflictDoNothing().returning();
}
