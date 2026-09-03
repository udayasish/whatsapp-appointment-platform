import { Router } from "express";
import bcrypt from "bcryptjs";
import { and, eq, or, asc } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  tenants,
  doctors,
  users,
  appointments,
  adminUsers,
} from "../../lib/db/index.js";
import { env } from "../../lib/env.js";
import { requireAdminSession } from "./middleware.js";
import { loginRateLimit } from "./login-rate-limit.js";
import { generateWaMeLink, sanitizePhoneNumber } from "../../common/wa-link.js";
import { getClinicQrInfo, generateQrPngBuffer, generateQrSvg } from "../qr/index.js";

export const adminRouter = Router();

const loginSchema = z.object({ password: z.string().min(1) });

adminRouter.post("/login", loginRateLimit, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "password is required" });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.password, env.ADMIN_PASSWORD_HASH);
  if (!valid) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  req.session.isAdmin = true;
  res.json({ ok: true });
});

adminRouter.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

/**
 * GET /tenants
 * Lists all registered clinics with status, settings, and QR endpoints.
 */
adminRouter.get("/tenants", requireAdminSession, async (_req, res) => {
  const rows = await db.query.tenants.findMany({
    with: {
      doctors: true,
    },
  });

  const withQr = rows.map((r) => {
    const cleanPhone = sanitizePhoneNumber(r.whatsappDisplayNumber);
    const waMeUrl = generateWaMeLink({ phone: cleanPhone, text: "Hi" });
    const primaryDoctor = r.doctors?.[0];
    return {
      id: r.id,
      name: r.name,
      status: r.status,
      remindersEnabled: r.remindersEnabled,
      notificationsEnabled: r.notificationsEnabled,
      whatsappDisplayNumber: r.whatsappDisplayNumber,
      whatsappPhoneNumberId: r.whatsappPhoneNumberId,
      doctorName: primaryDoctor?.name ?? "Primary Doctor",
      specialization: primaryDoctor?.specialization ?? "General Medicine",
      cleanPhone,
      waMeUrl,
      posterUrl: `/qr/${r.id}/poster`,
      imageUrl: `/qr/${r.id}/image`,
    };
  });

  res.json(withQr);
});

const createTenantSchema = z.object({
  name: z.string().min(1),
  whatsappPhoneNumberId: z.string().min(1),
  whatsappDisplayNumber: z.string().min(1),
  doctorName: z.string().optional(),
  specialization: z.string().optional(),
  timezone: z.string().default("Asia/Kolkata"),
});

/**
 * POST /tenants
 * Registers a new clinic, creates its initial doctor, and creates its clinic admin login.
 */
adminRouter.post("/tenants", requireAdminSession, async (req, res) => {
  const parsed = createTenantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
    return;
  }

  const {
    name,
    whatsappPhoneNumberId,
    whatsappDisplayNumber,
    doctorName,
    specialization,
    timezone,
  } = parsed.data;

  // 1. Create tenant
  const [tenant] = await db
    .insert(tenants)
    .values({
      name,
      whatsappPhoneNumberId,
      whatsappDisplayNumber,
      timezone,
      status: "active",
      remindersEnabled: true,
      notificationsEnabled: true,
    })
    .returning();

  if (!tenant) {
    res.status(500).json({ error: "Failed to create clinic" });
    return;
  }

  // 2. Create initial doctor user & doctor profile
  const cleanPhone = sanitizePhoneNumber(whatsappDisplayNumber);
  const docName = doctorName || "Primary Doctor";

  const [docUser] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      phoneNumber: cleanPhone,
      role: "doctor",
      name: docName,
    })
    .returning();

  let createdDoctor;
  if (docUser) {
    const [doc] = await db
      .insert(doctors)
      .values({
        tenantId: tenant.id,
        userId: docUser.id,
        specialization: specialization || "General Physician",
        consultationDurationMinutes: 15,
      })
      .returning();
    createdDoctor = doc;
  }

  // 3. Create clinic admin login in admin_users
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const clinicEmail = `admin@${slug}.com`;
  const defaultPasswordHash = await bcrypt.hash("Password@123", 10);

  await db
    .insert(adminUsers)
    .values({
      email: clinicEmail,
      passwordHash: defaultPasswordHash,
      name: `${name} Admin`,
      role: "clinic_admin",
      tenantId: tenant.id,
      status: "active",
    })
    .onConflictDoNothing();

  const waMeUrl = generateWaMeLink({ phone: cleanPhone, text: "Hi" });

  res.status(201).json({
    id: tenant.id,
    name: tenant.name,
    status: tenant.status,
    remindersEnabled: tenant.remindersEnabled,
    notificationsEnabled: tenant.notificationsEnabled,
    whatsappDisplayNumber: tenant.whatsappDisplayNumber,
    whatsappPhoneNumberId: tenant.whatsappPhoneNumberId,
    doctorName: docName,
    specialization: specialization || "General Physician",
    cleanPhone,
    waMeUrl,
    posterUrl: `/qr/${tenant.id}/poster`,
    imageUrl: `/qr/${tenant.id}/image`,
    adminEmail: clinicEmail,
  });
});

/**
 * PATCH /tenants/:id/status
 * Soft-deletes / suspends or reactivates a clinic.
 */
adminRouter.patch("/tenants/:id/status", requireAdminSession, async (req, res) => {
  const statusSchema = z.object({
    status: z.enum(["active", "inactive", "suspended"]),
  });

  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid status value" });
    return;
  }

  const [updated] = await db
    .update(tenants)
    .set({ status: parsed.data.status })
    .where(eq(tenants.id, String(req.params.id)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }

  res.json(updated);
});

/**
 * GET /tenants/:id/qr
 */
adminRouter.get("/tenants/:id/qr", requireAdminSession, async (req, res) => {
  const info = await getClinicQrInfo(String(req.params.id));
  if (!info) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  res.json(info);
});

/**
 * GET /tenants/:id/qr/download
 */
adminRouter.get("/tenants/:id/qr/download", requireAdminSession, async (req, res) => {
  const info = await getClinicQrInfo(String(req.params.id));
  if (!info) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }

  const format = req.query.format === "svg" ? "svg" : "png";
  const size = Math.min(Math.max(Number(req.query.size) || 1600, 100), 4000);
  const slug = info.clinicName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const filename = `${slug}-whatsapp-qr.${format}`;

  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  if (format === "svg") {
    const svg = await generateQrSvg(info.waMeUrl, { width: size });
    res.setHeader("Content-Type", "image/svg+xml");
    res.send(svg);
    return;
  }

  const pngBuffer = await generateQrPngBuffer(info.waMeUrl, { width: size });
  res.setHeader("Content-Type", "image/png");
  res.send(pngBuffer);
});

const settingsSchema = z
  .object({
    remindersEnabled: z.boolean().optional(),
    notificationsEnabled: z.boolean().optional(),
  })
  .refine((v) => v.remindersEnabled !== undefined || v.notificationsEnabled !== undefined, {
    message: "At least one of remindersEnabled/notificationsEnabled must be provided",
  });

/**
 * PATCH /tenants/:id/settings
 */
adminRouter.patch("/tenants/:id/settings", requireAdminSession, async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
    return;
  }

  const [updated] = await db
    .update(tenants)
    .set(parsed.data)
    .where(eq(tenants.id, String(req.params.id)))
    .returning({
      id: tenants.id,
      name: tenants.name,
      remindersEnabled: tenants.remindersEnabled,
      notificationsEnabled: tenants.notificationsEnabled,
    });

  if (!updated) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }

  res.json(updated);
});

/**
 * GET /clinics/:tenantId/queue
 * Returns live appointments queue for a clinic on a specific date.
 */
adminRouter.get("/clinics/:tenantId/queue", requireAdminSession, async (req, res) => {
  const tenantIdentifier = String(req.params.tenantId);
  const dateParam = String(req.query.date || new Date().toISOString().split("T")[0]);

  // Resolve tenant by ID or phone number ID
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

  const aptRows = await db.query.appointments.findMany({
    where: and(
      eq(appointments.tenantId, tenant.id),
      eq(appointments.appointmentDate, dateParam)
    ),
    orderBy: [asc(appointments.tokenNumber)],
    with: {
      patient: true,
    },
  });

  const formattedQueue = aptRows.map((a) => ({
    id: a.id,
    tokenNumber: a.tokenNumber,
    patientName: a.patientName,
    patientAge: a.patientAge,
    patientPhone: a.patient?.phoneNumber ? `+${a.patient.phoneNumber}` : "WhatsApp Patient",
    timeSlot: a.appointmentTime,
    complaint: a.complaint || "Routine Consultation",
    status: a.status,
  }));

  res.json(formattedQueue);
});

/**
 * PATCH /appointments/:id/status
 * Updates appointment status to booked, completed, noshow, or cancelled.
 */
adminRouter.patch("/appointments/:id/status", requireAdminSession, async (req, res) => {
  const aptStatusSchema = z.object({
    status: z.enum(["booked", "completed", "noshow", "cancelled"]),
  });

  const parsed = aptStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid status value" });
    return;
  }

  const [updated] = await db
    .update(appointments)
    .set({ status: parsed.data.status })
    .where(eq(appointments.id, String(req.params.id)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  res.json(updated);
});
