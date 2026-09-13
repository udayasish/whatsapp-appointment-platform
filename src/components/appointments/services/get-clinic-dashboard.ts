import { and, eq, desc, asc, or } from "drizzle-orm";
import { db, appointments, tenants, type AppointmentStatus } from "../../../lib/db/index.js";
import { formatDateLong } from "../../../common/format.js";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatTime12Hour(timeStr: string): string {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
}

function formatRelativeTimestamp(date: Date): string {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const targetDateStr = date.toISOString().slice(0, 10);

  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const timeFormatted = formatTime12Hour(`${hours}:${minutes}:00`);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (targetDateStr === todayStr) {
    return `Today, ${timeFormatted}`;
  } else if (targetDateStr === yesterdayStr) {
    return `Yesterday, ${timeFormatted}`;
  } else {
    return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${timeFormatted}`;
  }
}

export interface DashboardAppointmentItem {
  id: string;
  token: string;
  date?: string;
  rawDate?: string;
  time: string;
  duration: string;
  status: AppointmentStatus;
  patientName: string;
  patientDetails: string;
  patientPhone: string;
  doctorName: string;
  doctorSpecialty: string;
  channel: string;
  complaint: string;
}

export interface DashboardRecentBookingItem {
  id: string;
  patientName: string;
  doctorName: string;
  timestamp: string;
}

export interface ClinicDashboardSummary {
  clinic: {
    id: string;
    name: string;
    whatsappDisplayNumber: string;
    status: string;
  };
  metrics: {
    totalAppointments: number;
    upcoming: number;
    completed: number;
    cancelled: number;
    noshow: number;
  };
  upcomingAppointments: DashboardAppointmentItem[];
  recentBookings: DashboardRecentBookingItem[];
}

export async function getClinicDashboard(
  tenantIdentifier: string,
  dateParam?: string
): Promise<ClinicDashboardSummary | null> {
  const targetDate = dateParam || todayDateString();

  // Find tenant
  const tenant = await db.query.tenants.findFirst({
    where: or(
      eq(tenants.id, tenantIdentifier),
      eq(tenants.whatsappPhoneNumberId, tenantIdentifier)
    ),
  });

  if (!tenant) {
    return null;
  }

  // 1. Fetch all appointments for the clinic on targetDate (today)
  const todayAppointments = await db.query.appointments.findMany({
    where: and(
      eq(appointments.tenantId, tenant.id),
      eq(appointments.appointmentDate, targetDate)
    ),
    orderBy: [asc(appointments.tokenNumber)],
    with: {
      patient: true,
      doctor: {
        with: {
          user: true,
        },
      },
    },
  });

  // Calculate metrics
  let upcomingCount = 0;
  let completedCount = 0;
  let cancelledCount = 0;
  let noshowCount = 0;

  for (const a of todayAppointments) {
    if (a.status === "booked") upcomingCount++;
    else if (a.status === "completed") completedCount++;
    else if (a.status === "cancelled") cancelledCount++;
    else if (a.status === "noshow") noshowCount++;
  }

  // Map upcoming appointments (active / booked status)
  const upcomingAppointments: DashboardAppointmentItem[] = todayAppointments
    .filter((a) => a.status === "booked")
    .map((a) => {
      const docUser = a.doctor?.user;
      const docName = docUser?.name ? `Dr. ${docUser.name}` : "Doctor";
      const docSpecialty = a.doctor?.specialization || "General Physician";
      const durationMins = a.doctor?.consultationDurationMinutes || 15;
      const patientPhone = a.patient?.phoneNumber ? `+${a.patient.phoneNumber}` : "WhatsApp Patient";

      return {
        id: a.id,
        token: `TOKEN #${String(a.tokenNumber).padStart(2, "0")}`,
        date: formatDateLong(a.appointmentDate),
        rawDate: a.appointmentDate,
        time: formatTime12Hour(a.appointmentTime),
        duration: `${durationMins} mins`,
        status: a.status,
        patientName: a.patientName,
        patientDetails: `${a.patientAge} yrs`,
        patientPhone,
        doctorName: docName,
        doctorSpecialty: docSpecialty,
        channel: "Booked via WhatsApp",
        complaint: a.complaint || "Routine Consultation",
      };
    });

  // 2. Fetch recent bookings (last 5 created across all dates)
  const recentRows = await db.query.appointments.findMany({
    where: eq(appointments.tenantId, tenant.id),
    orderBy: [desc(appointments.createdAt)],
    limit: 5,
    with: {
      doctor: {
        with: {
          user: true,
        },
      },
    },
  });

  const recentBookings: DashboardRecentBookingItem[] = recentRows.map((r) => {
    const docUser = r.doctor?.user;
    const docName = docUser?.name ? `Dr. ${docUser.name}` : "Doctor";
    return {
      id: r.id,
      patientName: r.patientName,
      doctorName: docName,
      timestamp: formatRelativeTimestamp(new Date(r.createdAt)),
    };
  });

  return {
    clinic: {
      id: tenant.id,
      name: tenant.name,
      whatsappDisplayNumber: tenant.whatsappDisplayNumber,
      status: tenant.status,
    },
    metrics: {
      totalAppointments: todayAppointments.length,
      upcoming: upcomingCount,
      completed: completedCount,
      cancelled: cancelledCount,
      noshow: noshowCount,
    },
    upcomingAppointments,
    recentBookings,
  };
}
