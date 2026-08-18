import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool, tenants, users, doctors } from "./index.js";
import { generateSlots } from "../../components/slots/services/index.js";
import { env } from "../env.js";
import logger from "../logger.js";

const SEED_TENANT_PHONE_NUMBER_ID = "100000000000001";
// No leading "+" — Meta's Cloud API sends webhook `from`/`to` values as plain
// digits (country code + number), never E.164-with-plus. Stored to match
// exactly, since role resolution is an exact-string lookup.
const SEED_DOCTOR_PHONE = "919800000001";
const SEED_RECEPTIONIST_PHONE = "919800000002";

async function seed() {
  const [insertedTenant] = await db
    .insert(tenants)
    .values({
      name: "Sunrise Clinic",
      whatsappPhoneNumberId: SEED_TENANT_PHONE_NUMBER_ID,
      whatsappDisplayNumber: "+15550001111",
    })
    .onConflictDoNothing()
    .returning();

  const tenant =
    insertedTenant ??
    (await db.query.tenants.findFirst({
      where: eq(tenants.whatsappPhoneNumberId, SEED_TENANT_PHONE_NUMBER_ID),
    }));
  if (!tenant) throw new Error("Failed to seed tenant");

  const [insertedDoctorUser] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      phoneNumber: SEED_DOCTOR_PHONE,
      role: "doctor",
      name: "Dr. Asha Verma",
    })
    .onConflictDoNothing()
    .returning();

  const doctorUser =
    insertedDoctorUser ??
    (await db.query.users.findFirst({
      where: eq(users.phoneNumber, SEED_DOCTOR_PHONE),
    }));
  if (!doctorUser) throw new Error("Failed to seed doctor user");

  const [insertedDoctor] = await db
    .insert(doctors)
    .values({
      tenantId: tenant.id,
      userId: doctorUser.id,
      specialization: "General Physician",
      consultationDurationMinutes: 15,
    })
    .onConflictDoNothing()
    .returning();

  const doctor =
    insertedDoctor ??
    (await db.query.doctors.findFirst({
      where: eq(doctors.userId, doctorUser.id),
    }));
  if (!doctor) throw new Error("Failed to seed doctor profile");

  await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      phoneNumber: SEED_RECEPTIONIST_PHONE,
      role: "receptionist",
      name: "Priya (Reception)",
    })
    .onConflictDoNothing();

  const createdSlots = await generateSlots({
    tenantId: tenant.id,
    doctorId: doctor.id,
    weekdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    startTime: "09:00",
    endTime: "12:00",
    durationMinutes: 15,
    horizonDays: env.BOOKING_HORIZON_DAYS,
  });

  logger.info("Seed complete", {
    tenantId: tenant.id,
    doctorId: doctor.id,
    receptionistPhone: SEED_RECEPTIONIST_PHONE,
    slotsCreated: createdSlots.length,
  });
}

seed()
  .catch((err) => {
    logger.error("Seed failed", { err });
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
