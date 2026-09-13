import { and, eq, gte, ilike, or, sql, asc } from "drizzle-orm";
import { db, appointments } from "../../../lib/db/index.js";
import { SearchAppointmentsInput } from "../schemas/search.schema.js";

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface AppointmentItem {
  id: string;
  token: string;
  tokenNumber: number;
  date: string; // Formatted e.g. "Sat, 12 Sep"
  rawDate: string; // "YYYY-MM-DD"
  time: string;
  duration: string;
  status: "booked" | "completed" | "cancelled" | "noshow";
  patientName: string;
  patientDetails: string;
  patientPhone: string;
  doctorName: string;
  doctorSpecialty: string;
  channel: string;
  complaint: string;
}

export interface SearchAppointmentsResult {
  data: AppointmentItem[];
  meta: PaginationMeta;
  counts: {
    all: number;
    booked: number;
    completed: number;
    cancelled: number;
    noshow: number;
  };
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

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    if (!year || !month || !day) return dateStr;
    const d = new Date(year, month - 1, day);
    const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
    const monthShort = d.toLocaleDateString("en-US", { month: "short" });
    return `${weekday}, ${day} ${monthShort}`;
  } catch {
    return dateStr;
  }
}

export async function searchAppointments(
  tenantId: string,
  input: SearchAppointmentsInput
): Promise<SearchAppointmentsResult> {
  const { q, page = 1, limit = 10, status, date, scope = "date" } = input;
  const today = new Date().toISOString().split("T")[0];

  const conditions = [eq(appointments.tenantId, tenantId)];
  const countConditions = [eq(appointments.tenantId, tenantId)];

  // Scope & Date conditions
  if (scope === "upcoming") {
    conditions.push(gte(appointments.appointmentDate, today));
    countConditions.push(gte(appointments.appointmentDate, today));

    if (status) {
      conditions.push(eq(appointments.status, status));
    } else {
      // By default in upcoming scope, show booked appointments
      conditions.push(eq(appointments.status, "booked"));
    }
  } else if (scope === "date" || date) {
    const targetDate = date || today;
    conditions.push(eq(appointments.appointmentDate, targetDate));
    countConditions.push(eq(appointments.appointmentDate, targetDate));

    if (status) {
      conditions.push(eq(appointments.status, status));
    }
  } else {
    // "all" scope
    if (status) {
      conditions.push(eq(appointments.status, status));
    }
  }

  // Multi-field search condition (following ConexusCRM-BE ilike pattern)
  if (q && q.trim()) {
    const rawQ = q.trim();
    const likeQ = `%${rawQ}%`;
    const cleanDigits = rawQ.replace(/\D/g, "");

    const searchOrList = [
      ilike(appointments.patientName, likeQ),
      ilike(appointments.complaint, likeQ),
      sql`EXISTS (SELECT 1 FROM users WHERE users.id = ${appointments.patientId} AND users.phone_number ILIKE ${likeQ})`,
      sql`EXISTS (SELECT 1 FROM doctors JOIN users ON users.id = doctors.user_id WHERE doctors.id = ${appointments.doctorId} AND users.name ILIKE ${likeQ})`,
    ];

    if (cleanDigits) {
      searchOrList.push(
        sql`CAST(${appointments.tokenNumber} AS text) = ${cleanDigits}`,
        sql`EXISTS (SELECT 1 FROM users WHERE users.id = ${appointments.patientId} AND regexp_replace(users.phone_number, '\\D', '', 'g') ILIKE ${`%${cleanDigits}%`})`
      );
    }

    conditions.push(or(...searchOrList)!);
  }

  const whereClause = and(...conditions);
  const countWhereClause = and(...countConditions);
  const offset = (page - 1) * limit;

  // Execute paginated findMany + count query in parallel
  const [aptRows, totalCount, statusCountsRows] = await Promise.all([
    db.query.appointments.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [
        asc(appointments.appointmentDate),
        asc(appointments.tokenNumber),
      ],
      with: {
        patient: true,
        doctor: {
          with: { user: true },
        },
      },
    }),
    db.$count(appointments, whereClause),
    db
      .select({
        status: appointments.status,
        count: sql<number>`count(*)::int`,
      })
      .from(appointments)
      .where(countWhereClause)
      .groupBy(appointments.status),
  ]);

  const counts = {
    all: 0,
    booked: 0,
    completed: 0,
    cancelled: 0,
    noshow: 0,
  };

  for (const row of statusCountsRows) {
    if (row.status in counts) {
      counts[row.status as keyof typeof counts] = row.count;
    }
    counts.all += row.count;
  }

  const data: AppointmentItem[] = aptRows.map((a) => {
    const docUser = a.doctor?.user;
    const docName = docUser?.name ? `Dr. ${docUser.name}` : "Doctor";
    const docSpecialty = a.doctor?.specialization || "General Physician";
    const durationMins = a.doctor?.consultationDurationMinutes || 15;
    const patientPhone = a.patient?.phoneNumber
      ? `+${a.patient.phoneNumber}`
      : "WhatsApp Patient";

    return {
      id: a.id,
      token: `TOKEN #${String(a.tokenNumber).padStart(2, "0")}`,
      tokenNumber: a.tokenNumber,
      date: formatDateDisplay(a.appointmentDate),
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

  const totalPages = Math.ceil(totalCount / limit) || 1;

  return {
    data,
    meta: {
      total: totalCount,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    counts,
  };
}
