import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, tenants } from "../../lib/db/index.js";
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

adminRouter.get("/tenants", requireAdminSession, async (_req, res) => {
  const rows = await db.query.tenants.findMany({
    columns: {
      id: true,
      name: true,
      status: true,
      remindersEnabled: true,
      notificationsEnabled: true,
      whatsappDisplayNumber: true,
      whatsappPhoneNumberId: true,
    },
  });

  const withQr = rows.map((r) => {
    const cleanPhone = sanitizePhoneNumber(r.whatsappDisplayNumber);
    const waMeUrl = generateWaMeLink({ phone: cleanPhone, text: "Hi" });
    return {
      ...r,
      cleanPhone,
      waMeUrl,
      posterUrl: `/qr/${r.id}/poster`,
      imageUrl: `/qr/${r.id}/image`,
    };
  });

  res.json(withQr);
});

adminRouter.get("/tenants/:id/qr", requireAdminSession, async (req, res) => {
  const info = await getClinicQrInfo(String(req.params.id));
  if (!info) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  res.json(info);
});

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
