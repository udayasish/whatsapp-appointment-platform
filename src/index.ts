import { env, logger } from "./lib/index.js";
import { closeWorkers } from "./lib/bull/index.js";
import { pool } from "./lib/db/index.js";
import { app } from "./app.js";
// Side-effect imports: self-register message handlers with the WhatsApp router
// and instantiate the BullMQ workers.
import "./components/booking/index.js";
import "./components/staff/index.js";
import "./components/appointments/queue/reminder-worker.js";
import "./components/reports/queue/report-worker.js";
import "./components/notifications/queue/notification-worker.js";
import { syncMorningSummarySchedulers } from "./components/notifications/queue/index.js";

const server = app.listen(env.PORT, () => {
  logger.info(
    `whatsapp-appointment-platform listening on port ${env.PORT} (${env.NODE_ENV})`
  );
  syncMorningSummarySchedulers().catch((err: unknown) => {
    logger.error("Failed to sync morning-summary schedulers at boot", { err });
  });
});


async function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down`);
  server.close();
  try {
    await closeWorkers();
    await pool.end();
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  logger.error(reason instanceof Error ? reason : new Error(String(reason)));
  server.close(() => process.exit(1));
});

process.on("uncaughtException", (err) => {
  logger.error(err);
  process.exit(1);
});
