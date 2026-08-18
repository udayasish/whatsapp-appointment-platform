import { and, eq } from "drizzle-orm";
import { db, slots, type Slot } from "../../../lib/db/index.js";

export async function listAvailableSlots(
  doctorId: string,
  date: string
): Promise<Slot[]> {
  return db
    .select()
    .from(slots)
    .where(
      and(
        eq(slots.doctorId, doctorId),
        eq(slots.slotDate, date),
        eq(slots.status, "available")
      )
    )
    .orderBy(slots.startTime);
}
