import { and, eq } from "drizzle-orm";
import { db, slots } from "../../../lib/db/index.js";
import type { DayOfWeek } from "../../../lib/db/models/enums.js";

const JS_DAY_TO_ENUM: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export async function copyDoctorSlots(
  tenantId: string,
  doctorId: string,
  fromDate: string,
  toDate: string
): Promise<{ copiedCount: number }> {
  if (fromDate === toDate) {
    throw new Error("Source date and target date must be different");
  }

  const sourceSlots = await db
    .select()
    .from(slots)
    .where(
      and(
        eq(slots.tenantId, tenantId),
        eq(slots.doctorId, doctorId),
        eq(slots.slotDate, fromDate)
      )
    );

  if (sourceSlots.length === 0) {
    throw new Error(`No timings configured on ${fromDate} to copy.`);
  }

  const [y, m, d] = toDate.split("-").map(Number);
  const targetDayOfWeek = JS_DAY_TO_ENUM[new Date(y, m - 1, d).getDay()];

  let copiedCount = 0;
  for (const s of sourceSlots) {
    const [created] = await db
      .insert(slots)
      .values({
        tenantId,
        doctorId,
        slotDate: toDate,
        dayOfWeek: targetDayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        status: "available",
        maxPatients: s.maxPatients ?? 30,
      })
      .onConflictDoNothing()
      .returning();

    if (created) copiedCount++;
  }

  return { copiedCount };
}
