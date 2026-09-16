import type { Request, Response, NextFunction } from "express";
import { env, logger } from "../../../lib/index.js";

/**
 * Middleware to restrict IVR webhook endpoints to Exotel's IP addresses in production.
 *
 * In development, or if EXOTEL_IP_ALLOWLIST is not configured or set to "*",
 * requests are allowed through without restriction.
 */
export function exotelIpAllowlistMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const allowlistConfig = env.EXOTEL_IP_ALLOWLIST?.trim();

  // If not configured, set to wildcard, or in development mode, bypass check
  if (!allowlistConfig || allowlistConfig === "*" || env.NODE_ENV === "development") {
    return next();
  }

  const allowedIps = allowlistConfig
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);

  // Extract client IP (handling reverse proxies / X-Forwarded-For)
  const forwardedFor = req.headers["x-forwarded-for"];
  let clientIp = "";

  if (typeof forwardedFor === "string") {
    clientIp = forwardedFor.split(",")[0].trim();
  } else if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    clientIp = forwardedFor[0].trim();
  } else {
    clientIp = req.ip || req.socket.remoteAddress || "";
  }

  // Strip IPv6-mapped IPv4 prefix (e.g. ::ffff:52.74.1.209)
  if (clientIp.startsWith("::ffff:")) {
    clientIp = clientIp.substring(7);
  }

  const isAllowed = allowedIps.includes(clientIp);

  if (!isAllowed) {
    logger.warn("IVR webhook request blocked by IP allowlist", {
      clientIp,
      path: req.originalUrl,
      method: req.method,
    });
    res.status(403).send("Forbidden: IP not allowed");
    return;
  }

  next();
}
