import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { bullConnection, defaultJobOptions, registerWorker } from "../../../lib/bull/index.js";
import type { ReportJobData } from "../../../lib/bull/queues.js";
import { db, reports, tenants, users } from "../../../lib/db/index.js";
import logger from "../../../lib/logger.js";
import { sendWhatsAppMessage } from "../../whatsapp/services/index.js";

const reportWorker = new Worker<ReportJobData>(
  "report_queue",
  async (job) => {
    const report = await db.query.reports.findFirst({
      where: eq(reports.id, job.data.reportId),
    });
    if (!report || report.status === "sent") return;

    const [patient, tenant] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, report.patientId) }),
      db.query.tenants.findFirst({ where: eq(tenants.id, report.tenantId) }),
    ]);
    if (!patient || !tenant) {
      throw new Error(`Missing patient/tenant for report ${report.id}`);
    }

    // report.fileUrl is the WhatsApp media id the PDF was originally
    // uploaded under — re-sent by id via the document message type.
    await sendWhatsAppMessage({
      tenantId: tenant.id,
      phoneNumberId: tenant.whatsappPhoneNumberId,
      to: patient.phoneNumber,
      payload: {
        type: "document",
        document: {
          id: report.fileUrl,
          ...(report.caption ? { caption: report.caption } : {}),
        },
      },
    });

    await db.update(reports).set({ status: "sent" }).where(eq(reports.id, report.id));
  },
  { connection: bullConnection }
);

// Reflect BullMQ's own retry count on the row, and mark it permanently
// failed once every configured attempt (defaultJobOptions.attempts) is
// exhausted.
reportWorker.on("failed", (job, err) => {
  if (!job) return;
  const maxAttempts =
    typeof job.opts.attempts === "number" ? job.opts.attempts : defaultJobOptions.attempts;
  const isFinalAttempt = job.attemptsMade >= maxAttempts;

  db.update(reports)
    .set({
      retryCount: job.attemptsMade,
      ...(isFinalAttempt ? { status: "failed" as const } : {}),
    })
    .where(eq(reports.id, job.data.reportId))
    .catch((updateErr) => {
      logger.error("Failed to update report status after job failure", {
        reportId: job.data.reportId,
        err: updateErr,
      });
    });

  if (isFinalAttempt) {
    logger.error("Report delivery permanently failed", { reportId: job.data.reportId, err });
  }
});

registerWorker(reportWorker);
