import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, tenants } from "../../lib/db/index.js";
import { env } from "../../lib/env.js";
import { requireAdminSession } from "./middleware.js";
import { loginRateLimit } from "./login-rate-limit.js";

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
    },
  });
  res.json(rows);
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
