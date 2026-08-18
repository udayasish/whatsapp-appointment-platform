import { and, eq, gte } from "drizzle-orm";
import { db, slots } from "../../../lib/db/index.js";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Distinct upcoming dates that still have at least one available slot for this doctor. */
export async function listAvailableDates(
  doctorId: string,
  maxDates = 7
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ slotDate: slots.slotDate })
    .from(slots)
    .where(
      and(
        eq(slots.doctorId, doctorId),
        eq(slots.status, "available"),
        gte(slots.slotDate, todayDateString())
      )
    )
    .orderBy(slots.slotDate)
    .limit(maxDates);

  return rows.map((r) => r.slotDate);
}
