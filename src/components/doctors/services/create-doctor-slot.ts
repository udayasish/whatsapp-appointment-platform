import { and, eq } from "drizzle-orm";
import { formatTime12h } from "../../../common/format.js";
import { db, doctors, slots } from "../../../lib/db/index.js";
import type { DayOfWeek } from "../../../lib/db/models/enums.js";
import type { DoctorDateSlotItem } from "./list-doctor-date-slots.js";

const JS_DAY_TO_ENUM: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

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

function addMinutesTo24h(time24h: string, minutes: number): string {
  const [h, m] = time24h.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export interface CreateDoctorSlotInput {
  tenantId: string;
  doctorId: string;
  date: string;
  startTime: string;
  endTime?: string;
  maxPatients?: number;
}

export async function createDoctorSlot(
  input: CreateDoctorSlotInput
): Promise<DoctorDateSlotItem> {
  const { tenantId, doctorId, date, startTime, endTime, maxPatients = 30 } = input;

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Date must be in YYYY-MM-DD format");
  }

  const doctor = await db.query.doctors.findFirst({
    where: and(eq(doctors.id, doctorId), eq(doctors.tenantId, tenantId)),
  });

  if (!doctor) {
    throw new Error("Doctor not found");
  }

  const cleanStart = parseTo24Hour(startTime);
  const duration = doctor.consultationDurationMinutes || 30;
  const cleanEnd = endTime ? parseTo24Hour(endTime) : addMinutesTo24h(cleanStart, duration);

  if (cleanStart >= cleanEnd) {
    throw new Error("End time must be after start time");
  }

  // Calculate day of week
  const [y, m, d] = date.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayOfWeek = JS_DAY_TO_ENUM[dateObj.getDay()];

  // Check duplicate
  const existing = await db.query.slots.findFirst({
    where: and(
      eq(slots.doctorId, doctorId),
      eq(slots.slotDate, date),
      eq(slots.startTime, cleanStart)
    ),
  });

  if (existing) {
    throw new Error(`A slot starting at ${formatTime12h(cleanStart)} already exists on ${date}`);
  }

  const [created] = await db
    .insert(slots)
    .values({
      tenantId,
      doctorId,
      slotDate: date,
      dayOfWeek,
      startTime: cleanStart,
      endTime: cleanEnd,
      status: "available",
      maxPatients: maxPatients > 0 ? maxPatients : 30,
    })
    .returning();

  const isEvening = Number(cleanStart.split(":")[0]) >= 12;

  return {
    id: created.id,
    slotDate: created.slotDate,
    dayOfWeek: created.dayOfWeek,
    startTime: created.startTime,
    endTime: created.endTime,
    time12h: `${formatTime12h(created.startTime)} - ${formatTime12h(created.endTime)}`,
    shift: isEvening ? "Evening" : "Morning",
    status: created.status,
    maxPatients: created.maxPatients,
    bookedCount: 0,
    remainingCapacity: created.maxPatients,
    appointments: [],
  };
}
