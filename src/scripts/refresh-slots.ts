import "dotenv/config";
import { and, eq, lt } from "drizzle-orm";
import { db, pool, doctors, slots, tenants } from "../lib/db/index.js";
import { generateSlots } from "../components/slots/services/index.js";
import logger from "../lib/logger.js";

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

  let totalMorningSlots = 0;
  let totalEveningSlots = 0;

  for (const doc of activeDoctors) {
    const clinicName = doc.tenant?.name || "Unknown Clinic";
    const doctorName = doc.user?.name || "Doctor";

    logger.info(`Generating slots for ${doctorName} at ${clinicName}...`);

    // 1. Morning Session: 09:00 to 13:00 (Mon - Sat)
    const morningSlots = await generateSlots({
      tenantId: doc.tenantId,
      doctorId: doc.id,
      weekdays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
      startTime: "09:00",
      endTime: "13:00",
      durationMinutes: doc.consultationDurationMinutes || 15,
      horizonDays: 14,
    });

    // 2. Evening Session: 16:00 to 19:00 (Mon - Sat)
    const eveningSlots = await generateSlots({
      tenantId: doc.tenantId,
      doctorId: doc.id,
      weekdays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
      startTime: "16:00",
      endTime: "19:00",
      durationMinutes: doc.consultationDurationMinutes || 15,
      horizonDays: 14,
    });

    totalMorningSlots += morningSlots.length;
    totalEveningSlots += eveningSlots.length;

    logger.info(`  -> Created ${morningSlots.length} morning slots & ${eveningSlots.length} evening slots for ${doctorName}`);
  }

  logger.info(`Slot refresh complete! Added ${totalMorningSlots + totalEveningSlots} total new slots across all clinics.`);
}

refreshAllSlots()
  .catch((err) => {
    logger.error("Slot refresh failed", { err });
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
