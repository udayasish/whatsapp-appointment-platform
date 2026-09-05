import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool, doctors, slots, tenants } from "../lib/db/index.js";
import logger from "../lib/logger.js";
import type { DayOfWeek } from "../lib/db/models/enums.js";

const DAY_NAMES: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

// 2 slots per day: Morning 9:00 AM and Evening 3:00 PM (15:00)
const DAILY_SLOT_TIMES = [
  { startTime: "09:00", endTime: "09:30" },
  { startTime: "15:00", endTime: "15:30" },
];

async function refreshAllSlots() {
  const activeTenants = await db.query.tenants.findMany({
    where: eq(tenants.status, "active"),
  });

  logger.info(`Starting slot refresh for ${activeTenants.length} active clinic(s)...`);

  const activeDoctors = await db.query.doctors.findMany({
    where: eq(doctors.isActive, true),
    with: { user: true, tenant: true },
  });

  logger.info(`Found ${activeDoctors.length} active doctor(s) across clinics.`);

  const HORIZON_DAYS = 7;
  const newSlotRows: (typeof slots.$inferInsert)[] = [];

  for (const doc of activeDoctors) {
    const clinicName = doc.tenant?.name || "Unknown Clinic";
    const doctorName = doc.user?.name || "Doctor";

    logger.info(`Generating slots for ${doctorName} at ${clinicName}...`);

    for (let offset = 1; offset <= HORIZON_DAYS; offset++) {
      const d = new Date(2026, 8, 3 + offset);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const slotDate = `${yyyy}-${mm}-${dd}`;
      const dayOfWeek = DAY_NAMES[d.getDay()]!;

      // Leave Sunday empty
      if (dayOfWeek === "sunday") continue;

      for (const t of DAILY_SLOT_TIMES) {
        newSlotRows.push({
          tenantId: doc.tenantId,
          doctorId: doc.id,
          slotDate,
          dayOfWeek,
          startTime: t.startTime,
          endTime: t.endTime,
          status: "available",
        });
      }
    }
  }

  if (newSlotRows.length > 0) {
    await db.insert(slots).values(newSlotRows).onConflictDoNothing();
  }

  logger.info(`Slot refresh complete! Added slots across all active clinics.`);
}

refreshAllSlots()
  .catch((err) => {
    logger.error("Slot refresh failed", { err });
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
