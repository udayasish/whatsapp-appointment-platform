import type { NextFunction, Request, Response } from "express";
import { bullConnection } from "../../lib/bull/index.js";

const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 10;

/**
 * Fixed-window brute-force guard on /api/admin/login, keyed by IP. Reuses
 * the existing BullMQ ioredis connection — plain INCR/EXPIRE, no need for
 * the node-redis client the session store requires.
 */
export async function loginRateLimit(req: Request, res: Response, next: NextFunction) {
  try {
    const key = `admin:login-attempts:${req.ip}`;
    // Race with a 1500ms timeout so Redis outages never hang the login endpoint
    const attempts = await Promise.race([
      bullConnection.incr(key),
      new Promise<number>((_, reject) =>
        setTimeout(() => reject(new Error("Redis rate-limit timeout")), 1500)
      ),
    ]);
    if (attempts === 1) {
      await bullConnection.expire(key, WINDOW_SECONDS);
    }
    if (attempts > MAX_ATTEMPTS) {
      res.status(429).json({ error: "Too many login attempts. Try again later." });
      return;
    }
  } catch {
    // Fail-open: if Redis is down, allow login so authentication is never blocked by cache outages
  }
  next();
}
