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
  const key = `admin:login-attempts:${req.ip}`;
  const attempts = await bullConnection.incr(key);
  if (attempts === 1) {
    await bullConnection.expire(key, WINDOW_SECONDS);
  }
  if (attempts > MAX_ATTEMPTS) {
    res.status(429).json({ error: "Too many login attempts. Try again later." });
    return;
  }
  next();
}
