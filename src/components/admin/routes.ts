import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, tenants, doctors, users, adminUsers } from "../../lib/db/index.js";
import { generateAccessToken } from "../../lib/jwt.js";
import { requireAdminAuth, requireSuperAdmin } from "../../middlewares/index.js";
import { loginRateLimit } from "./login-rate-limit.js";
import { loginAdmin } from "./services/login.js";
import { generateWaMeLink, sanitizePhoneNumber } from "../../common/wa-link.js";
import {
  loginSchema,
  createTenantSchema,
  tenantStatusSchema,
  tenantSettingsSchema,
} from "./schemas/index.js";

export const adminRouter = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ---------------------------------------------------------------------------
// AUTH ROUTES  (public or self-hydrating)
// ---------------------------------------------------------------------------

/**
 * POST /api/admin/auth/login
 * Accepts { email, password }, returns { ok, token, user } and sets httpOnly admin_token cookie.
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
      token,
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
 * POST /api/admin/auth/logout
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
 * GET /api/admin/auth/me
 * Returns the currently authenticated admin user.
 */
adminRouter.get("/auth/me", requireAdminAuth, (req, res) => {
  const adminUser = (req as typeof req & { adminUser: Record<string, unknown> }).adminUser;
  res.json({ user: adminUser });
});

// ---------------------------------------------------------------------------
// TENANT ROUTES  (super admin only)
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/tenants
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

/**
 * POST /api/admin/tenants
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
 * PATCH /api/admin/tenants/:id/status
 * Suspends or reactivates a clinic.
 */
adminRouter.patch("/tenants/:id/status", requireAdminAuth, requireSuperAdmin, async (req, res) => {
  const parsed = tenantStatusSchema.safeParse(req.body);
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
 * PATCH /api/admin/tenants/:id/settings
 * Updates reminders or notifications toggles.
 */
adminRouter.patch("/tenants/:id/settings", requireAdminAuth, requireSuperAdmin, async (req, res) => {
  const parsed = tenantSettingsSchema.safeParse(req.body);
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
