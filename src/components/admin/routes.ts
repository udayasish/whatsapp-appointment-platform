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
import { generateAccessToken } from "../../lib/jwt.js";
import { requireAdminAuth, requireSuperAdmin } from "./middleware.js";
import { loginRateLimit } from "./login-rate-limit.js";
import { loginAdmin } from "./services/login.js";
import { generateWaMeLink, sanitizePhoneNumber } from "../../common/wa-link.js";
import { getClinicQrInfo, generateQrPngBuffer, generateQrSvg } from "../qr/index.js";

export const adminRouter = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ---------------------------------------------------------------------------
// AUTH ROUTES  (no middleware — these are public)
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /admin/auth/login
 * Accepts { email, password }, returns { user } and sets httpOnly admin_token cookie.
 */
adminRouter.post("/auth/login", loginRateLimit, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const user = await loginAdmin(parsed.data.email, parsed.data.password);
    const token = await generateAccessToken(user);

    res.cookie("admin_token", token, COOKIE_OPTS);
    res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
    });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Login failed" });
  }
});

/**
 * POST /admin/auth/logout
 * Clears the admin_token cookie.
 */
adminRouter.post("/auth/logout", (_req, res) => {
  res.clearCookie("admin_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  res.json({ ok: true });
});

/**
 * GET /admin/auth/me
 * Returns the currently authenticated admin user.
 * Used by the Next.js frontend on every page load to hydrate Redux auth state.
 */
adminRouter.get("/auth/me", requireAdminAuth, (req, res) => {
  const adminUser = (req as typeof req & { adminUser: Record<string, unknown> }).adminUser;
  res.json({ user: adminUser });
});

// ---------------------------------------------------------------------------
// TENANT ROUTES  (super admin only)
// ---------------------------------------------------------------------------

/**
 * GET /admin/tenants
 * Lists all registered clinics with status, settings, and QR endpoints.
 */
adminRouter.get("/tenants", requireAdminAuth, requireSuperAdmin, async (_req, res) => {
  const rows = await db.query.tenants.findMany({
    with: {
      doctors: {
        with: { user: true },
      },
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
      doctorName: primaryDoctor?.user?.name ?? "Primary Doctor",
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
 * POST /admin/tenants
 * Registers a new clinic, creates its initial doctor, and creates a clinic admin login.
 */
adminRouter.post("/tenants", requireAdminAuth, requireSuperAdmin, async (req, res) => {
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

  if (docUser) {
    await db
      .insert(doctors)
      .values({
        tenantId: tenant.id,
        userId: docUser.id,
        specialization: specialization || "General Physician",
        consultationDurationMinutes: 15,
      });
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
 * PATCH /admin/tenants/:id/status
 * Suspends or reactivates a clinic.
 */
adminRouter.patch("/tenants/:id/status", requireAdminAuth, requireSuperAdmin, async (req, res) => {
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
 * PATCH /admin/tenants/:id/settings
 */
const settingsSchema = z
  .object({
    remindersEnabled: z.boolean().optional(),
    notificationsEnabled: z.boolean().optional(),
  })
  .refine(
    (v) => v.remindersEnabled !== undefined || v.notificationsEnabled !== undefined,
    { message: "At least one of remindersEnabled/notificationsEnabled must be provided" }
  );

adminRouter.patch("/tenants/:id/settings", requireAdminAuth, requireSuperAdmin, async (req, res) => {
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
 * GET /admin/tenants/:id/qr
 */
adminRouter.get("/tenants/:id/qr", requireAdminAuth, requireSuperAdmin, async (req, res) => {
  const info = await getClinicQrInfo(String(req.params.id));
  if (!info) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  res.json(info);
});

/**
 * GET /admin/tenants/:id/qr/download
 */
adminRouter.get("/tenants/:id/qr/download", requireAdminAuth, requireSuperAdmin, async (req, res) => {
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

// ---------------------------------------------------------------------------
// CLINIC QUEUE ROUTES  (both super_admin and clinic_admin can access)
// ---------------------------------------------------------------------------

/**
 * GET /admin/clinics/:tenantId/queue
 * Returns live appointments queue for a clinic on a specific date.
 * Clinic admins can only access their own clinic's queue.
 */
adminRouter.get("/clinics/:tenantId/queue", requireAdminAuth, async (req, res) => {
  const reqWithUser = req as typeof req & { adminUser: { role: string; tenantId: string | null } };
  const tenantIdentifier = String(req.params.tenantId);
  const dateParam = String(req.query.date || new Date().toISOString().split("T")[0]);

  // Clinic admins can only see their own queue
  if (
    reqWithUser.adminUser.role === "clinic_admin" &&
    reqWithUser.adminUser.tenantId !== tenantIdentifier
  ) {
    res.status(403).json({ error: "Access denied to this clinic's queue" });
    return;
  }

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
 * PATCH /admin/appointments/:id/status
 */
adminRouter.patch("/appointments/:id/status", requireAdminAuth, async (req, res) => {
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
