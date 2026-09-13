import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool, doctors, slots, appointments, tenants } from "../lib/db/index.js";
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

// Exactly 2 slots per day: Morning 9:00 AM and Evening 3:00 PM (15:00)
const DAILY_SLOT_TIMES = [
  { startTime: "09:00", endTime: "09:30" },
  { startTime: "15:00", endTime: "15:30" },
];

function formatDateString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function resetSlots(options: { startFromToday?: boolean } = {}) {
  logger.info("==================================================");
  logger.info("  RESET SLOTS: Deleting and Regenerating Slots    ");
  logger.info("==================================================");

  // 1. Delete all existing appointments (due to foreign key constraint with slots)
  const existingAppts = await db.select().from(appointments);
  if (existingAppts.length > 0) {
    logger.info(`Deleting ${existingAppts.length} existing appointment(s)...`);
    await db.delete(appointments);
  }

  // 2. Delete all existing slots
  const existingSlots = await db.select().from(slots);
  logger.info(`Deleting all ${existingSlots.length} existing slot(s)...`);
  await db.delete(slots);

  // 3. Find active doctors across active clinics
  const activeTenants = await db.query.tenants.findMany({
    where: eq(tenants.status, "active"),
  });

  const activeDoctors = await db.query.doctors.findMany({
    where: eq(doctors.isActive, true),
    with: { user: true, tenant: true },
  });

  if (activeDoctors.length === 0) {
    logger.warn("No active doctors found in the database. Exiting.");
    return;
  }

  logger.info(`Found ${activeDoctors.length} active doctor(s) across ${activeTenants.length} active clinic(s).`);

  // 4. Determine the next 6 appointment dates from current date (skipping Sunday)
  const TARGET_OPERATING_DAYS = 6;
  const targetDates: { dateStr: string; dayOfWeek: DayOfWeek }[] = [];

  const cursor = new Date();
  if (!options.startFromToday) {
    // Default: start from tomorrow so morning slots for today are never generated in the past
    cursor.setDate(cursor.getDate() + 1);
  }

  while (targetDates.length < TARGET_OPERATING_DAYS) {
    const dayOfWeek = DAY_NAMES[cursor.getDay()]!;

    // Leave Sunday empty (clinic closed on Sunday)
    if (dayOfWeek !== "sunday") {
      targetDates.push({
        dateStr: formatDateString(cursor),
        dayOfWeek,
      });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  logger.info(`Generated ${targetDates.length} appointment dates from current date:`);
  for (const td of targetDates) {
    logger.info(`  • ${td.dateStr} (${td.dayOfWeek}) - 2 slots (09:00 AM & 03:00 PM)`);
  }

  // 5. Generate slots for each active doctor
  const newSlotRows: (typeof slots.$inferInsert)[] = [];

  for (const doc of activeDoctors) {
    const clinicName = doc.tenant?.name || "Clinic";
    const doctorName = doc.user?.name || "Doctor";

    logger.info(`Adding slots for Dr. ${doctorName} at ${clinicName}...`);

    for (const td of targetDates) {
      for (const t of DAILY_SLOT_TIMES) {
        newSlotRows.push({
          tenantId: doc.tenantId,
          doctorId: doc.id,
          slotDate: td.dateStr,
          dayOfWeek: td.dayOfWeek,
          startTime: t.startTime,
          endTime: t.endTime,
          status: "available",
          maxPatients: 30,
        });
      }
    }
  }

  // 6. Insert new slots into database
  logger.info(`Inserting ${newSlotRows.length} slots into database...`);
  await db.insert(slots).values(newSlotRows);

  logger.info("==================================================");
  logger.info(`✅ Successfully reset slots! Total slots inserted: ${newSlotRows.length}`);
  logger.info("==================================================");
}

// Run CLI directly if executed
const isCli = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("reset-slots.ts") || process.argv[1]?.endsWith("refresh-slots.ts");

if (isCli) {
  const startFromToday = process.argv.includes("--today") || process.argv.includes("--include-today");

  resetSlots({ startFromToday })
    .catch((err) => {
      console.error("Failed to reset slots:", err?.message || err);
      if (err?.cause) console.error("Cause:", err.cause);
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
    });
}
