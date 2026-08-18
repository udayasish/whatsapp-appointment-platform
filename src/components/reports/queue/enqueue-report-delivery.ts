import { reportQueue } from "../../../lib/bull/queues.js";

/** Enqueues delivery of an uploaded report PDF to the patient. Called by the staff REPORT command (Phase 5). */
export async function enqueueReportDelivery(reportId: string): Promise<void> {
  await reportQueue.add("deliver-report", { reportId });
}
