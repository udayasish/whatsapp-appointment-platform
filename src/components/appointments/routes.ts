import { Router } from "express";
import { and, eq, or, asc } from "drizzle-orm";
import { db, appointments, tenants } from "../../lib/db/index.js";
import { requireAdminAuth } from "../../middlewares/index.js";
import {
  updateAppointmentStatusSchema,
  createAppointmentSchema,
  searchAppointmentsSchema,
} from "./schemas/index.js";
import {
  getClinicDashboard,
  cancelAppointment,
  markAppointmentDone,
  markAppointmentNoShow,
  createAppointmentFromBooking,
  searchAppointments,
} from "./services/index.js";

export const appointmentsRouter = Router();

/**
 * GET /api/appointments/clinics/:tenantId/dashboard
 * Aggregated Home screen summary: metrics, upcoming appointments, and recent bookings.
 */
appointmentsRouter.get(
  "/clinics/:tenantId/dashboard",
  requireAdminAuth,
  async (req, res) => {
    const reqWithUser = req as typeof req & {
      adminUser: { role: string; tenantId: string | null };
    };
    const tenantIdentifier = String(req.params.tenantId);
    const dateParam = req.query.date ? String(req.query.date) : undefined;

    // Clinic admins can only view their own clinic
    if (
      reqWithUser.adminUser.role === "clinic_admin" &&
      reqWithUser.adminUser.tenantId !== tenantIdentifier
    ) {
      res
        .status(403)
        .json({ error: "Access denied to this clinic's dashboard" });
      return;
    }

    const summary = await getClinicDashboard(tenantIdentifier, dateParam);
    if (!summary) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    res.json(summary);
  },
);

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

/**
 * GET /api/appointments/clinics/:tenantId/queue
 * Live queue view for a specific date (defaults to today).
 * Returns status counts and fully formatted appointments list.
 */
appointmentsRouter.get(
  "/clinics/:tenantId/queue",
  requireAdminAuth,
  async (req, res) => {
    const reqWithUser = req as typeof req & {
      adminUser: { role: string; tenantId: string | null };
    };
    const tenantIdentifier = String(req.params.tenantId);

    if (
      reqWithUser.adminUser.role === "clinic_admin" &&
      reqWithUser.adminUser.tenantId !== tenantIdentifier
    ) {
      res.status(403).json({ error: "Access denied to this clinic's queue" });
      return;
    }

    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        tenantIdentifier,
      );
    let resolvedTenantId = isUuid ? tenantIdentifier : null;

    if (!resolvedTenantId) {
      const tenant = await db.query.tenants.findFirst({
        where: or(
          eq(tenants.id, tenantIdentifier),
          eq(tenants.whatsappPhoneNumberId, tenantIdentifier),
        ),
      });

      if (!tenant) {
        res.status(404).json({ error: "Tenant not found" });
        return;
      }
      resolvedTenantId = tenant.id;
    }

    const queryInput = searchAppointmentsSchema.parse(req.query);
    const result = await searchAppointments(resolvedTenantId, queryInput);

    res.json({
      data: result.data,
      appointments: result.data, // backward compatibility
      meta: result.meta,
      counts: result.counts,
      date: queryInput.date || new Date().toISOString().split("T")[0],
    });
  },
);

/**
 * PATCH /api/appointments/:id/status
 * Updates appointment status (booked, completed, noshow, cancelled).
 */
appointmentsRouter.patch("/:id/status", requireAdminAuth, async (req, res) => {
  const parsed = updateAppointmentStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid status value", details: parsed.error.issues });
    return;
  }

  const appointmentId = String(req.params.id);
  const { status, cancelReason } = parsed.data;

  // Fetch existing appointment to check slot and tenant
  const existing = await db.query.appointments.findFirst({
    where: eq(appointments.id, appointmentId),
  });

  if (!existing) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  const reqWithUser = req as typeof req & {
    adminUser: { role: string; tenantId: string | null };
  };
  if (
    reqWithUser.adminUser.role === "clinic_admin" &&
    reqWithUser.adminUser.tenantId !== existing.tenantId
  ) {
    res.status(403).json({ error: "Access denied to this appointment" });
    return;
  }

  if (status === "cancelled") {
    await cancelAppointment(
      appointmentId,
      existing.slotId,
      cancelReason || "Cancelled by admin",
    );
  } else if (status === "completed") {
    await markAppointmentDone(appointmentId);
  } else if (status === "noshow") {
    await markAppointmentNoShow(appointmentId);
  } else {
    await db
      .update(appointments)
      .set({ status: "booked" })
      .where(eq(appointments.id, appointmentId));
  }

  const updated = await db.query.appointments.findFirst({
    where: eq(appointments.id, appointmentId),
  });

  res.json(updated);
});

/**
 * POST /api/appointments
 * Creates an appointment manually.
 */
appointmentsRouter.post("/", requireAdminAuth, async (req, res) => {
  const parsed = createAppointmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({
        error: "Invalid appointment payload",
        details: parsed.error.issues,
      });
    return;
  }

  const created = await createAppointmentFromBooking(parsed.data);
  if (!created) {
    res.status(409).json({ error: "Slot already booked or unavailable" });
    return;
  }

  res.status(201).json(created);
});
