import { and, eq, sql } from "drizzle-orm";
import { formatTime12h } from "../../../common/format.js";
import { appointments, db, slots } from "../../../lib/db/index.js";
import type { DoctorDateSlotItem } from "./list-doctor-date-slots.js";

function parseTo24Hour(timeStr: string): string {
  const trimmed = timeStr.trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const [h, m] = trimmed.split(":");
    return `${h.padStart(2, "0")}:${m}`;
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

export interface UpdateDoctorSlotInput {
  tenantId: string;
  doctorId: string;
  slotId: string;
  startTime?: string;
  endTime?: string;
  maxPatients?: number;
}

export async function updateDoctorSlot(
  input: UpdateDoctorSlotInput
): Promise<DoctorDateSlotItem> {
  const { tenantId, doctorId, slotId, startTime, endTime, maxPatients } = input;

  const existing = await db.query.slots.findFirst({
    where: and(
      eq(slots.id, slotId),
      eq(slots.doctorId, doctorId),
      eq(slots.tenantId, tenantId)
    ),
  });

  if (!existing) {
    throw new Error("Slot not found");
  }

  const updateData: Partial<typeof slots.$inferInsert> = {};

  const cleanStart = startTime ? parseTo24Hour(startTime) : existing.startTime;
  const cleanEnd = endTime ? parseTo24Hour(endTime) : existing.endTime;

  if (startTime || endTime) {
    if (cleanStart >= cleanEnd) {
      throw new Error("End time must be after start time");
    }
    updateData.startTime = cleanStart;
    updateData.endTime = cleanEnd;
  }

  // Count existing active booked appointments for this slot
  const [{ activeCount }] = await db
    .select({ activeCount: sql<number>`count(*)::int` })
    .from(appointments)
    .where(
      and(
        eq(appointments.slotId, slotId),
        eq(appointments.status, "booked")
      )
    );

  const bookedCount = Number(activeCount);

  if (maxPatients !== undefined) {
    if (maxPatients <= 0) {
      throw new Error("Max patients must be at least 1");
    }
    if (bookedCount > maxPatients) {
      throw new Error(
        `Cannot set capacity to ${maxPatients} because ${bookedCount} patient(s) are already booked for this timing.`
      );
    }
    updateData.maxPatients = maxPatients;
  }

  const effectiveMaxPatients = maxPatients !== undefined ? maxPatients : existing.maxPatients;
  if (existing.status !== "blocked") {
    updateData.status = bookedCount >= effectiveMaxPatients ? "booked" : "available";
  }

  const [updated] = await db
    .update(slots)
    .set(updateData)
    .where(eq(slots.id, slotId))
    .returning();

  const isEvening = Number(updated.startTime.split(":")[0]) >= 12;

  return {
    id: updated.id,
    slotDate: updated.slotDate,
    dayOfWeek: updated.dayOfWeek,
    startTime: updated.startTime,
    endTime: updated.endTime,
    time12h: `${formatTime12h(updated.startTime)} - ${formatTime12h(updated.endTime)}`,
    shift: isEvening ? "Evening" : "Morning",
    status: updated.status,
    maxPatients: updated.maxPatients,
    bookedCount,
    remainingCapacity: Math.max(0, updated.maxPatients - bookedCount),
  };
}
