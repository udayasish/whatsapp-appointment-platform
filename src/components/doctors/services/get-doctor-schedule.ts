import { and, eq, gte, or } from "drizzle-orm";
import { formatDateLong, formatTime12h } from "../../../common/format.js";
import { blockedDates, db, doctors, slots, users } from "../../../lib/db/index.js";
import type { DayOfWeek } from "../../../lib/db/models/enums.js";

export interface DayScheduleData {
  day: string;
  dayOfWeek: DayOfWeek;
  enabled: boolean;
  slotsCount: number;
  startTime: string;
  endTime: string;
  hasEveningShift: boolean;
  eveningStart: string;
  eveningEnd: string;
}

export interface BlockedDateData {
  id: string;
  date: string;
  displayDate: string;
  reason: string;
  notes: string | null;
}

export interface DoctorScheduleResponse {
  doctor: {
    id: string;
    userId: string;
    name: string;
    initials: string;
    specialty: string;
    consultationDurationMinutes: number;
    isActive: boolean;
    phoneNumber?: string;
  };
  schedule: DayScheduleData[];
  blockedDates: BlockedDateData[];
}

const WEEKDAYS: { key: DayOfWeek; label: string; defaultSlots: number; defaultEnd: string }[] = [
  { key: "monday", label: "Monday", defaultSlots: 1, defaultEnd: "09:30 AM" },
  { key: "tuesday", label: "Tuesday", defaultSlots: 1, defaultEnd: "09:30 AM" },
  { key: "wednesday", label: "Wednesday", defaultSlots: 1, defaultEnd: "09:30 AM" },
  { key: "thursday", label: "Thursday", defaultSlots: 1, defaultEnd: "09:30 AM" },
  { key: "friday", label: "Friday", defaultSlots: 1, defaultEnd: "09:30 AM" },
  { key: "saturday", label: "Saturday", defaultSlots: 1, defaultEnd: "09:30 AM" },
  { key: "sunday", label: "Sunday", defaultSlots: 0, defaultEnd: "09:30 AM" },
];

function computeInitials(name: string): string {
  if (!name) return "DR";
  const cleaned = name.replace(/^(dr\.|dr|doctor)\s+/i, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (name.slice(0, 2) || "DR").toUpperCase();
}

function timeToMinutes(timeStr: string): number {
  const [hStr, mStr] = timeStr.split(":");
  return Number(hStr) * 60 + Number(mStr);
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getDoctorSchedule(
  tenantId: string,
  doctorId: string
): Promise<DoctorScheduleResponse> {
  const doctor = await db.query.doctors.findFirst({
    where: and(eq(doctors.id, doctorId), eq(doctors.tenantId, tenantId)),
    with: { user: true },
  });

  if (!doctor) {
    throw new Error("Doctor not found");
  }

  const doctorName = doctor.user?.name || "Doctor";
  const today = todayDateString();

  // Fetch upcoming available or booked slots
  const upcomingSlots = await db
    .select({
      dayOfWeek: slots.dayOfWeek,
      startTime: slots.startTime,
      endTime: slots.endTime,
    })
    .from(slots)
    .where(
      and(
        eq(slots.doctorId, doctorId),
        gte(slots.slotDate, today),
        or(eq(slots.status, "available"), eq(slots.status, "booked"))
      )
    )
    .orderBy(slots.startTime);

  // Group by dayOfWeek
  const slotsByDay = new Map<DayOfWeek, { startTime: string; endTime: string }[]>();
  for (const slot of upcomingSlots) {
    const list = slotsByDay.get(slot.dayOfWeek) || [];
    list.push({ startTime: slot.startTime, endTime: slot.endTime });
    slotsByDay.set(slot.dayOfWeek, list);
  }

  const schedule: DayScheduleData[] = WEEKDAYS.map((w) => {
    const daySlots = slotsByDay.get(w.key);

    if (!daySlots || daySlots.length === 0) {
      return {
        day: w.label,
        dayOfWeek: w.key,
        enabled: w.key !== "sunday", // Sunday default closed if no slots
        slotsCount: 0,
        startTime: "09:00 AM",
        endTime: w.defaultEnd,
        hasEveningShift: false,
        eveningStart: "03:00 PM",
        eveningEnd: "03:30 PM",
      };
    }

    // Deduplicate distinct slot intervals on this weekday
    const uniqueMap = new Map<string, string>();
    for (const s of daySlots) {
      uniqueMap.set(s.startTime, s.endTime);
    }

    const sortedStarts = Array.from(uniqueMap.keys()).sort();
    const sortedIntervals = sortedStarts.map((st) => ({
      startTime: st,
      endTime: uniqueMap.get(st)!,
    }));

    // Detect shift gaps (gap >= 60 minutes)
    let morningIntervals = sortedIntervals;
    let eveningIntervals: { startTime: string; endTime: string }[] = [];
    let splitIdx = -1;

    for (let i = 0; i < sortedIntervals.length - 1; i++) {
      const currentEndMin = timeToMinutes(sortedIntervals[i].endTime);
      const nextStartMin = timeToMinutes(sortedIntervals[i + 1].startTime);
      if (nextStartMin - currentEndMin >= 60) {
        splitIdx = i + 1;
        break;
      }
    }

    if (splitIdx > -1) {
      morningIntervals = sortedIntervals.slice(0, splitIdx);
      eveningIntervals = sortedIntervals.slice(splitIdx);
    }

    const morningStart = formatTime12h(morningIntervals[0].startTime);
    const morningEnd = formatTime12h(morningIntervals[morningIntervals.length - 1].endTime);

    const hasEvening = eveningIntervals.length > 0;
    const eveningStart = hasEvening
      ? formatTime12h(eveningIntervals[0].startTime)
      : "03:00 PM";
    const eveningEnd = hasEvening
      ? formatTime12h(eveningIntervals[eveningIntervals.length - 1].endTime)
      : "03:30 PM";

    return {
      day: w.label,
      dayOfWeek: w.key,
      enabled: true,
      slotsCount: sortedIntervals.length,
      startTime: morningStart,
      endTime: morningEnd,
      hasEveningShift: hasEvening,
      eveningStart,
      eveningEnd,
    };
  });

  // Upcoming blocked dates
  const upcomingBlocked = await db
    .select()
    .from(blockedDates)
    .where(
      and(
        eq(blockedDates.doctorId, doctorId),
        gte(blockedDates.blockedDate, today)
      )
    )
    .orderBy(blockedDates.blockedDate);

  const blockedList: BlockedDateData[] = upcomingBlocked.map((b) => ({
    id: b.id,
    date: b.blockedDate,
    displayDate: formatDateLong(b.blockedDate),
    reason: b.reason,
    notes: b.notes,
  }));

  return {
    doctor: {
      id: doctor.id,
      userId: doctor.userId,
      name: doctorName,
      initials: computeInitials(doctorName),
      specialty: doctor.specialization || "General Physician",
      consultationDurationMinutes: doctor.consultationDurationMinutes,
      isActive: doctor.isActive,
      phoneNumber: doctor.user?.phoneNumber ? `+${doctor.user.phoneNumber}` : undefined,
    },
    schedule,
    blockedDates: blockedList,
  };
}
