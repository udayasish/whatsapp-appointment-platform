import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../env.js";
import logger from "../logger.js";
import * as schema from "./models/index.js";

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  // TCP keepalive so idle pooled connections survive NAT/proxy idle timeouts
  // (observed: Docker Desktop's WSL2 networking silently drops idle
  // connections, surfacing as ECONNRESET on the next query).
  keepAlive: true,
  // Fail fast on a dead connection instead of waiting on the OS's own TCP
  // timeout (observed ~26-30s) — bounds how long a retry has to wait before
  // it can kick in.
  connectionTimeoutMillis: 5_000,
});

// node-postgres emits 'error' on the pool when an idle client hits a
// connection-level error; without a listener this crashes the process.
pool.on("error", (err) => {
  logger.error("Unexpected error on idle Postgres client", { err });
});

export const db = drizzle(pool, { schema });
