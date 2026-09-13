import { and, eq } from "drizzle-orm";
import { formatTime12h } from "../../../common/format.js";
import { appointments, db, slots } from "../../../lib/db/index.js";

export interface DoctorDateSlotAppointmentItem {
  id: string;
  tokenNumber: number;
  patientName: string;
  patientAge: number;
  appointmentTime: string;
  status: string;
}

export interface DoctorDateSlotItem {
  id: string;
  slotDate: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  time12h: string;
  shift: "Morning" | "Evening";
  status: "available" | "booked" | "blocked" | "cancelled";
  maxPatients: number;
  bookedCount: number;
  remainingCapacity: number;
  tokenNumber?: number;
  patientName?: string;
  appointments?: DoctorDateSlotAppointmentItem[];
}

function isEveningTime(timeStr: string): boolean {
  const [hStr] = timeStr.split(":");
  const h = Number(hStr);
  return h >= 12;
}

export async function listDoctorDateSlots(
  tenantId: string,
  doctorId: string,
  dateStr: string
): Promise<DoctorDateSlotItem[]> {
  const doctorSlots = await db
    .select()
    .from(slots)
    .where(
      and(
        eq(slots.tenantId, tenantId),
        eq(slots.doctorId, doctorId),
        eq(slots.slotDate, dateStr)
      )
    )
    .orderBy(slots.startTime);

  if (doctorSlots.length === 0) {
    return [];
  }

  const slotIds = doctorSlots.map((s) => s.id);

  const bookedAppointments = await db
    .select({
      id: appointments.id,
      slotId: appointments.slotId,
      tokenNumber: appointments.tokenNumber,
      patientName: appointments.patientName,
      patientAge: appointments.patientAge,
      appointmentTime: appointments.appointmentTime,
      status: appointments.status,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.doctorId, doctorId),
        eq(appointments.appointmentDate, dateStr),
        eq(appointments.status, "booked")
      )
    )
    .orderBy(appointments.tokenNumber);

  const appointmentsBySlot = new Map<string, DoctorDateSlotAppointmentItem[]>();
  for (const appt of bookedAppointments) {
    const list = appointmentsBySlot.get(appt.slotId) || [];
    list.push({
      id: appt.id,
      tokenNumber: appt.tokenNumber,
      patientName: appt.patientName,
      patientAge: appt.patientAge,
      appointmentTime: appt.appointmentTime,
      status: appt.status,
    });
    appointmentsBySlot.set(appt.slotId, list);
  }

  return doctorSlots.map((s) => {
    const appts = appointmentsBySlot.get(s.id) || [];
    const maxPatients = s.maxPatients ?? 30;
    const bookedCount = appts.length;
    const remainingCapacity = Math.max(0, maxPatients - bookedCount);

    let effectiveStatus = s.status;
    if (s.status !== "blocked") {
      effectiveStatus = bookedCount >= maxPatients ? "booked" : "available";
    }

    const firstAppt = appts[0];

    return {
      id: s.id,
      slotDate: s.slotDate,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      time12h: `${formatTime12h(s.startTime)} - ${formatTime12h(s.endTime)}`,
      shift: isEveningTime(s.startTime) ? "Evening" : "Morning",
      status: effectiveStatus as "available" | "booked" | "blocked" | "cancelled",
      maxPatients,
      bookedCount,
      remainingCapacity,
      tokenNumber: firstAppt?.tokenNumber,
      patientName: firstAppt?.patientName,
      appointments: appts,
    };
  });
}
