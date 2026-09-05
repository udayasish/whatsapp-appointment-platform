import "dotenv/config";
import { db, pool, slots, appointments, doctors, tenants } from "../src/lib/db/index.js";
import { eq, and } from "drizzle-orm";
import type { DayOfWeek } from "../src/lib/db/models/enums.js";

const DAY_NAMES: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

// The 6 clean appointment slots per day
const DAILY_SLOT_TIMES = [
  { startTime: "09:00", endTime: "09:30" },
  { startTime: "10:00", endTime: "10:30" },
  { startTime: "11:00", endTime: "11:30" },
  { startTime: "16:00", endTime: "16:30" },
  { startTime: "17:00", endTime: "17:30" },
  { startTime: "18:00", endTime: "18:30" },
];

async function main() {
  console.log("Checking database connection and existing records...");

  const existingSlots = await db.select().from(slots);
  const existingAppts = await db.select().from(appointments);
  const activeDoctors = await db.query.doctors.findMany({
    where: eq(doctors.isActive, true),
    with: { user: true, tenant: true },
  });

  console.log(`Found ${existingSlots.length} existing slots`);
  console.log(`Found ${existingAppts.length} existing appointments`);
  console.log(`Found ${activeDoctors.length} active doctor(s)`);

  // Delete existing appointments first if any, then existing slots
  if (existingAppts.length > 0) {
    console.log(`Deleting ${existingAppts.length} test appointments...`);
    await db.delete(appointments);
  }

  console.log(`Deleting all ${existingSlots.length} old slots...`);
  await db.delete(slots);

  // Generate 6 slots starting tomorrow: Friday, September 4, 2026
  // Today is Thursday September 3, 2026.
  // Generate across the 10-day horizon, LEAVING SUNDAYS EMPTY.
  const HORIZON_DAYS = 10;
  const newSlotRows: (typeof slots.$inferInsert)[] = [];

  for (const doc of activeDoctors) {
    console.log(`\nGenerating 6 slots/day for ${doc.user?.name || "Doctor"} at ${doc.tenant?.name}...`);

    // Start from tomorrow: offset 1 (Sep 4, 2026) to offset 10 (Sep 13, 2026)
    for (let offset = 1; offset <= HORIZON_DAYS; offset++) {
      // Base date: 2026-09-03
      const d = new Date(2026, 8, 3 + offset); // Month 8 is September (0-indexed)
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const slotDate = `${yyyy}-${mm}-${dd}`;
      const dayOfWeek = DAY_NAMES[d.getDay()]!;

      // Leave Sunday empty
      if (dayOfWeek === "sunday") {
        console.log(`  Skipping Sunday: ${slotDate} (${dayOfWeek})`);
        continue;
      }

      console.log(`  Adding 6 slots for ${slotDate} (${dayOfWeek})...`);

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

  console.log(`\nInserting ${newSlotRows.length} total slots...`);
  await db.insert(slots).values(newSlotRows);

  console.log("✅ Successfully generated slots!");

  // Verify created slots
  const verifySlots = await db.select().from(slots);
  console.log(`Total slots now in database: ${verifySlots.length}`);

  // Summary per date
  const countsByDate: Record<string, number> = {};
  for (const s of verifySlots) {
    countsByDate[s.slotDate] = (countsByDate[s.slotDate] || 0) + 1;
  }
  console.log("\nSlots count per date:");
  for (const [date, count] of Object.entries(countsByDate).sort()) {
    const d = new Date(date);
    const day = DAY_NAMES[d.getDay()];
    console.log(`  ${date} (${day}): ${count} slots`);
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error("Failed to reset slots:", err);
  await pool.end();
  process.exit(1);
});
