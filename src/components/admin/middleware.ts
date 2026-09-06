// src/components/admin/middleware.ts
import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../../lib/jwt.js";
import { getAdminById } from "./services/get-admin-by-id.js";

/**
 * Reads the httpOnly "admin_token" cookie, verifies the JWT,
 * loads the admin user from DB, and attaches it to req.adminUser.
 *
 * Returns 401 if token is missing/invalid, 403 if account is suspended.
 */
export const requireAdminAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  }

  if (!token) {
    const cookieHeader = req.headers.cookie ?? "";
    for (const chunk of cookieHeader.split(";")) {
      const part = chunk.trim();
      if (part.startsWith("admin_token=")) {
        token = part.slice("admin_token=".length);
        break;
      }
    }
  }

  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  let payload: Awaited<ReturnType<typeof verifyAccessToken>>;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const adminUser = await getAdminById(payload.id);
  if (!adminUser) {
    res.status(401).json({ error: "Admin user not found or inactive" });
    return;
  }

  // Attach to request for downstream handlers
  (req as Request & { adminUser: typeof adminUser }).adminUser = adminUser;
  next();
};

/**
 * Additional guard for super-admin-only routes.
 * Must be used AFTER requireAdminAuth.
 */
export const requireSuperAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const user = (req as Request & { adminUser?: { role: string } }).adminUser;
  if (!user || user.role !== "super_admin") {
    res.status(403).json({ error: "Super admin access required" });
    return;
  }
  next();
};
