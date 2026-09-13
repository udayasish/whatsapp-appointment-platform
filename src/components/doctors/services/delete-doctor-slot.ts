import { and, eq } from "drizzle-orm";
import { db, slots } from "../../../lib/db/index.js";

export async function deleteDoctorSlot(
  tenantId: string,
  doctorId: string,
  slotId: string
): Promise<{ success: boolean; deletedSlotId: string }> {
  const existing = await db.query.slots.findFirst({
    where: and(
      eq(slots.id, slotId),
      eq(slots.doctorId, doctorId),
      eq(slots.tenantId, tenantId)
    ),
  });

  if (!existing) {
    throw new Error("Slot not found");
  }

  if (existing.status === "booked") {
    throw new Error(
      "This timing has an active patient booking. Please cancel or reassign the appointment first."
    );
  }

  await db.delete(slots).where(eq(slots.id, slotId));

  return { success: true, deletedSlotId: slotId };
}
