import { createClient } from "redis";
import { RedisStore } from "connect-redis";
import { env } from "../../lib/env.js";
import logger from "../../lib/logger.js";

/**
 * A separate node-redis client just for the admin session store.
 * BullMQ requires ioredis (`bullConnection` in lib/bull/index.ts); connect-redis
 * requires the `redis` package's client (it calls `.set(key, val, { expiration: {...} })`,
 * a node-redis v4 call shape ioredis doesn't support) — so this can't share that connection.
 */
const sessionRedisClient = createClient({ url: env.REDIS_URL });
sessionRedisClient.on("error", (err) => logger.error("Admin session Redis error", { err }));

let connectPromise: Promise<unknown> | null = null;
export function ensureSessionRedisConnected() {
  if (!connectPromise) connectPromise = sessionRedisClient.connect();
  return connectPromise;
}

export const sessionStore = new RedisStore({
  client: sessionRedisClient,
  prefix: "admin-sess:",
  ttl: 60 * 60 * 12, // 12 hours
});
