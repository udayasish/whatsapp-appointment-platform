import { eq } from "drizzle-orm";
import { notificationQueue } from "../../../lib/bull/queues.js";
import { db, tenants } from "../../../lib/db/index.js";

/**
 * Registers (or re-registers) one repeatable "morning-summary" job per active
 * tenant, firing daily at 8 AM in that tenant's own timezone — BullMQ/
 * cron-parser handles the timezone conversion (and DST) via the `tz` repeat
 * option, so no manual date math is needed here. Call at boot; safe to call
 * repeatedly since `upsertJobScheduler` is idempotent per scheduler id.
 */
export async function syncMorningSummarySchedulers(): Promise<void> {
  const activeTenants = await db.query.tenants.findMany({
    where: eq(tenants.status, "active"),
  });

  for (const tenant of activeTenants) {
    await notificationQueue.upsertJobScheduler(
      `tenant:${tenant.id}:morning-summary`,
      { pattern: "0 8 * * *", tz: tenant.timezone },
      { name: "morning-summary", data: { tenantId: tenant.id } }
    );
  }
}
