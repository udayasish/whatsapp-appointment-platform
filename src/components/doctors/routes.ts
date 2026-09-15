import { Router } from "express";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { db, doctors, tenants } from "../../lib/db/index.js";
import { blockedDateReasonEnum, dayOfWeekEnum } from "../../lib/db/models/enums.js";
import { requireAdminAuth } from "../../middlewares/index.js";
import {
  blockDoctorDate,
  getDoctorSchedule,
  listClinicDoctors,
  unblockDoctorDate,
  upsertDoctorSchedule,
  listDoctorDateSlots,
  createDoctorSlot,
  updateDoctorSlot,
  deleteDoctorSlot,
  copyDoctorSlots,
} from "./services/index.js";

export const doctorsRouter = Router();

const updateScheduleSchema = z.object({
  schedule: z.array(
    z.object({
      dayOfWeek: z.enum(dayOfWeekEnum.enumValues),
      enabled: z.boolean(),
      startTime: z.string().min(1),
      endTime: z.string().min(1),
      hasEveningShift: z.boolean().optional(),
      eveningStart: z.string().optional(),
      eveningEnd: z.string().optional(),
    })
  ),
});

const blockDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  reason: z.enum(blockedDateReasonEnum.enumValues).optional(),
  notes: z.string().max(500).optional(),
});

const createSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().optional(),
  maxPatients: z.number().int().positive().optional(),
});

const updateSlotSchema = z.object({
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  maxPatients: z.number().int().positive().optional(),
});

const copySlotsSchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Source date must be YYYY-MM-DD"),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Target date must be YYYY-MM-DD"),
});

/**
 * Helper to authenticate and authorize clinic admin access to a doctor.
 */
async function resolveDoctorAndVerifyAuth(
  req: unknown,
  doctorId: string
) {
  const reqWithUser = req as {
    adminUser: { role: string; tenantId: string | null };
  };

  let targetDoctorId = doctorId;
  if (doctorId === "default" || doctorId === "first" || doctorId === "undefined" || !doctorId) {
    if (reqWithUser.adminUser.tenantId) {
      const firstDoc = await db.query.doctors.findFirst({
        where: eq(doctors.tenantId, reqWithUser.adminUser.tenantId),
      });
      if (firstDoc) {
        targetDoctorId = firstDoc.id;
      }
    }
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetDoctorId);
  if (!isUuid) {
    return { doctor: null, error: { status: 400, message: "Invalid doctor ID format" } };
  }

  const doctor = await db.query.doctors.findFirst({
    where: eq(doctors.id, targetDoctorId),
  });

  if (!doctor) {
    return { doctor: null, error: { status: 404, message: "Doctor not found" } };
  }

  if (
    reqWithUser.adminUser.role === "clinic_admin" &&
    reqWithUser.adminUser.tenantId !== doctor.tenantId
  ) {
    return {
      doctor: null,
      error: { status: 403, message: "Access denied to this doctor's information" },
    };
  }

  return { doctor, error: null };
}

/**
 * GET /api/doctors/clinics/:tenantId
 * Lists all doctors registered for a specific clinic (both active and off-duty).
 */
doctorsRouter.get(
  "/clinics/:tenantId",
  requireAdminAuth,
  async (req, res) => {
    const reqWithUser = req as typeof req & {
      adminUser: { role: string; tenantId: string | null };
    };
    const tenantIdentifier = String(req.params.tenantId);

    // Clinic admins can only access their own clinic's doctors
    if (
      reqWithUser.adminUser.role === "clinic_admin" &&
      reqWithUser.adminUser.tenantId !== tenantIdentifier
    ) {
      res.status(403).json({ error: "Access denied to this clinic's doctors" });
      return;
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantIdentifier);
    let resolvedTenantId = isUuid ? tenantIdentifier : null;

    if (!resolvedTenantId) {
      const tenant = await db.query.tenants.findFirst({
        where: or(
          eq(tenants.id, tenantIdentifier),
          eq(tenants.whatsappPhoneNumberId, tenantIdentifier)
        ),
      });

      if (!tenant) {
        res.status(404).json({ error: "Tenant not found" });
        return;
      }
      resolvedTenantId = tenant.id;
    }

    try {
      const doctorsList = await listClinicDoctors(resolvedTenantId);
      res.json({
        data: doctorsList,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch doctors";
      res.status(500).json({ error: message });
    }
  }
);

/**
 * GET /api/doctors/:doctorId/schedule
 * Retrieves doctor schedule derived from slots along with upcoming blocked dates.
 */
doctorsRouter.get(
  "/:doctorId/schedule",
  requireAdminAuth,
  async (req, res) => {
    const doctorId = String(req.params.doctorId);
    const { doctor, error } = await resolveDoctorAndVerifyAuth(req, doctorId);

    if (error || !doctor) {
      res.status(error?.status || 404).json({ error: error?.message || "Doctor not found" });
      return;
    }

    try {
      const scheduleData = await getDoctorSchedule(doctor.tenantId, doctorId);
      res.json({
        data: scheduleData,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to retrieve schedule";
      res.status(500).json({ error: message });
    }
  }
);

/**
 * PUT /api/doctors/:doctorId/schedule
 * Updates doctor weekly schedule and synchronizes upcoming bookable slots.
 */
doctorsRouter.put(
  "/:doctorId/schedule",
  requireAdminAuth,
  async (req, res) => {
    const doctorId = String(req.params.doctorId);
    const { doctor, error } = await resolveDoctorAndVerifyAuth(req, doctorId);

    if (error || !doctor) {
      res.status(error?.status || 404).json({ error: error?.message || "Doctor not found" });
      return;
    }

    const parseResult = updateScheduleSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: "Invalid schedule format",
        details: parseResult.error.flatten(),
      });
      return;
    }

    try {
      const result = await upsertDoctorSchedule({
        tenantId: doctor.tenantId,
        doctorId,
        schedule: parseResult.data.schedule,
      });

      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update schedule";
      res.status(500).json({ error: message });
    }
  }
);

/**
 * POST /api/doctors/:doctorId/blocked-dates
 * Blocks a specific date, cancels affected appointments, and notifies patients.
 */
doctorsRouter.post(
  "/:doctorId/blocked-dates",
  requireAdminAuth,
  async (req, res) => {
    const doctorId = String(req.params.doctorId);
    const { doctor, error } = await resolveDoctorAndVerifyAuth(req, doctorId);

    if (error || !doctor) {
      res.status(error?.status || 404).json({ error: error?.message || "Doctor not found" });
      return;
    }

    const parseResult = blockDateSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: "Invalid block date input",
        details: parseResult.error.flatten(),
      });
      return;
    }

    try {
      const result = await blockDoctorDate({
        tenantId: doctor.tenantId,
        doctorId,
        date: parseResult.data.date,
        reason: parseResult.data.reason,
        notes: parseResult.data.notes,
      });

      res.json({
        message: `Date ${parseResult.data.date} successfully blocked`,
        data: result,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to block date";
      res.status(400).json({ error: message });
    }
  }
);

/**
 * DELETE /api/doctors/:doctorId/blocked-dates/:blockedDateId
 * Removes a blocked date and restores slot availability.
 */
doctorsRouter.delete(
  "/:doctorId/blocked-dates/:blockedDateId",
  requireAdminAuth,
  async (req, res) => {
    const doctorId = String(req.params.doctorId);
    const blockedDateId = String(req.params.blockedDateId);
    const { doctor, error } = await resolveDoctorAndVerifyAuth(req, doctorId);

    if (error || !doctor) {
      res.status(error?.status || 404).json({ error: error?.message || "Doctor not found" });
      return;
    }

    try {
      const result = await unblockDoctorDate({
        tenantId: doctor.tenantId,
        doctorId,
        blockedDateId,
      });

      res.json({
        message: `Date ${result.unblockedDate} unblocked and slots restored`,
        data: result,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to unblock date";
      res.status(400).json({ error: message });
    }
  }
);

/**
 * GET /api/doctors/:doctorId/slots
 * Retrieves all timings configured for a doctor on a specific date.
 */
doctorsRouter.get(
  "/:doctorId/slots",
  requireAdminAuth,
  async (req, res) => {
    const doctorId = String(req.params.doctorId);
    const { doctor, error } = await resolveDoctorAndVerifyAuth(req, doctorId);

    if (error || !doctor) {
      res.status(error?.status || 404).json({ error: error?.message || "Doctor not found" });
      return;
    }

    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

    try {
      const dateSlots = await listDoctorDateSlots(doctor.tenantId, doctor.id, date);
      res.json({
        data: dateSlots,
        date,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch date slots";
      res.status(500).json({ error: message });
    }
  }
);

/**
 * POST /api/doctors/:doctorId/slots
 * Directly creates a single consultation timing slot on a specific date in the database.
 */
doctorsRouter.post(
  "/:doctorId/slots",
  requireAdminAuth,
  async (req, res) => {
    const doctorId = String(req.params.doctorId);
    const { doctor, error } = await resolveDoctorAndVerifyAuth(req, doctorId);

    if (error || !doctor) {
      res.status(error?.status || 404).json({ error: error?.message || "Doctor not found" });
      return;
    }

    const parseResult = createSlotSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: "Invalid slot data",
        details: parseResult.error.flatten(),
      });
      return;
    }

    try {
      const createdSlot = await createDoctorSlot({
        tenantId: doctor.tenantId,
        doctorId: doctor.id,
        date: parseResult.data.date,
        startTime: parseResult.data.startTime,
        endTime: parseResult.data.endTime,
        maxPatients: parseResult.data.maxPatients,
      });

      res.status(201).json({
        data: createdSlot,
        message: "Timing added successfully",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create timing";
      res.status(400).json({ error: message });
    }
  }
);

/**
 * PATCH /api/doctors/:doctorId/slots/:slotId
 * Updates consultation timing and maxPatients capacity for a specific slot.
 */
doctorsRouter.patch(
  "/:doctorId/slots/:slotId",
  requireAdminAuth,
  async (req, res) => {
    const doctorId = String(req.params.doctorId);
    const slotId = String(req.params.slotId);
    const { doctor, error } = await resolveDoctorAndVerifyAuth(req, doctorId);

    if (error || !doctor) {
      res.status(error?.status || 404).json({ error: error?.message || "Doctor not found" });
      return;
    }

    const parseResult = updateSlotSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: "Invalid slot update data",
        details: parseResult.error.flatten(),
      });
      return;
    }

    try {
      const updatedSlot = await updateDoctorSlot({
        tenantId: doctor.tenantId,
        doctorId: doctor.id,
        slotId,
        startTime: parseResult.data.startTime,
        endTime: parseResult.data.endTime,
        maxPatients: parseResult.data.maxPatients,
      });

      res.json({
        data: updatedSlot,
        message: "Timing updated successfully",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update timing";
      res.status(400).json({ error: message });
    }
  }
);

/**
 * DELETE /api/doctors/:doctorId/slots/:slotId
 * Removes a specific available consultation timing from the database.
 */
doctorsRouter.delete(
  "/:doctorId/slots/:slotId",
  requireAdminAuth,
  async (req, res) => {
    const doctorId = String(req.params.doctorId);
    const slotId = String(req.params.slotId);
    const { doctor, error } = await resolveDoctorAndVerifyAuth(req, doctorId);

    if (error || !doctor) {
      res.status(error?.status || 404).json({ error: error?.message || "Doctor not found" });
      return;
    }

    try {
      const result = await deleteDoctorSlot(doctor.tenantId, doctor.id, slotId);
      res.json({
        data: result,
        message: "Timing removed successfully",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete timing";
      res.status(400).json({ error: message });
    }
  }
);

/**
 * POST /api/doctors/:doctorId/slots/copy
 * Copies all timings from one date to another target date.
 */
doctorsRouter.post(
  "/:doctorId/slots/copy",
  requireAdminAuth,
  async (req, res) => {
    const doctorId = String(req.params.doctorId);
    const { doctor, error } = await resolveDoctorAndVerifyAuth(req, doctorId);

    if (error || !doctor) {
      res.status(error?.status || 404).json({ error: error?.message || "Doctor not found" });
      return;
    }

    const parseResult = copySlotsSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: "Invalid copy request",
        details: parseResult.error.flatten(),
      });
      return;
    }

    try {
      const result = await copyDoctorSlots(
        doctor.tenantId,
        doctor.id,
        parseResult.data.fromDate,
        parseResult.data.toDate
      );

      res.json({
        data: result,
        message: `Copied ${result.copiedCount} timings to ${parseResult.data.toDate}`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to copy timings";
      res.status(400).json({ error: message });
    }
  }
);
