import { eq } from "drizzle-orm";
import { db, doctors, type Doctor } from "../../../lib/db/index.js";

export async function getDoctorByUserId(userId: string): Promise<Doctor | null> {
  const doctor = await db.query.doctors.findFirst({ where: eq(doctors.userId, userId) });
  return doctor ?? null;
}
