import { and, eq, gte, inArray } from "drizzle-orm";
import { blockedDates, db, doctors, slots } from "../../../lib/db/index.js";
import type { DayOfWeek } from "../../../lib/db/models/enums.js";
import { env } from "../../../lib/env.js";
import { generateSlots } from "../../slots/services/generate-slots.js";

export interface UpdateDayScheduleItem {
  dayOfWeek: DayOfWeek;
  enabled: boolean;
  startTime: string;
  endTime: string;
  hasEveningShift?: boolean;
  eveningStart?: string;
  eveningEnd?: string;
}

export interface UpdateDoctorScheduleParams {
  tenantId: string;
  doctorId: string;
  schedule: UpdateDayScheduleItem[];
}

function parseTime12hTo24h(timeStr: string): string {
  if (!timeStr) return "";
  const trimmed = timeStr.trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const [h, m] = trimmed.split(":");
    return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
  }
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return trimmed;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const period = match[3].toUpperCase();
  if (period === "PM" && h < 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m}`;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function upsertDoctorSchedule(
  params: UpdateDoctorScheduleParams
): Promise<{ message: string; slotsGenerated: number }> {
  const { tenantId, doctorId, schedule } = params;

  const doctor = await db.query.doctors.findFirst({
    where: and(eq(doctors.id, doctorId), eq(doctors.tenantId, tenantId)),
  });

  if (!doctor) {
    throw new Error("Doctor not found");
  }

  const today = todayDateString();

  // 1. Remove all future 'available' slots for this doctor so new slots replace them
  // Note: Booked and blocked slots are preserved
  await db
    .delete(slots)
    .where(
      and(
        eq(slots.doctorId, doctorId),
        gte(slots.slotDate, today),
        eq(slots.status, "available")
      )
    );

  let totalSlotsGenerated = 0;

  // 2. Generate slots for each enabled day
  for (const dayItem of schedule) {
    if (!dayItem.enabled) continue;

    const mStart = parseTime12hTo24h(dayItem.startTime);
    const mEnd = parseTime12hTo24h(dayItem.endTime);

    const duration = doctor.consultationDurationMinutes || 30;

    if (mStart && mEnd && mStart < mEnd) {
      const genRows = await generateSlots({
        tenantId,
        doctorId,
        weekdays: [dayItem.dayOfWeek],
        startTime: mStart,
        endTime: mEnd,
        durationMinutes: duration,
        horizonDays: 7,
      });
      totalSlotsGenerated += genRows.length;
    }

    if (
      dayItem.hasEveningShift &&
      dayItem.eveningStart &&
      dayItem.eveningEnd
    ) {
      const eStart = parseTime12hTo24h(dayItem.eveningStart);
      const eEnd = parseTime12hTo24h(dayItem.eveningEnd);

      if (eStart && eEnd && eStart < eEnd) {
        const genRows = await generateSlots({
          tenantId,
          doctorId,
          weekdays: [dayItem.dayOfWeek],
          startTime: eStart,
          endTime: eEnd,
          durationMinutes: duration,
          horizonDays: 7,
        });
        totalSlotsGenerated += genRows.length;
      }
    }
  }

  // 3. Re-enforce existing blocked dates so freshly generated slots on blocked dates are marked 'blocked'
  const upcomingBlocked = await db
    .select({ blockedDate: blockedDates.blockedDate })
    .from(blockedDates)
    .where(
      and(
        eq(blockedDates.doctorId, doctorId),
        gte(blockedDates.blockedDate, today)
      )
    );

  if (upcomingBlocked.length > 0) {
    const blockedDatesList = upcomingBlocked.map((b) => b.blockedDate);
    await db
      .update(slots)
      .set({ status: "blocked" })
      .where(
        and(
          eq(slots.doctorId, doctorId),
          inArray(slots.slotDate, blockedDatesList),
          eq(slots.status, "available")
        )
      );
  }

  return {
    message: "Schedule updated and slots synchronized",
    slotsGenerated: totalSlotsGenerated,
  };
}
