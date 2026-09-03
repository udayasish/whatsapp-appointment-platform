import "dotenv/config";
import bcrypt from "bcryptjs";
import { sql, eq } from "drizzle-orm";
import { db, pool, tenants, adminUsers } from "../lib/db/index.js";
import logger from "../lib/logger.js";

async function run() {
  logger.info("Initializing admin_users table in PostgreSQL...");

  // Ensure enum and table exist
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE admin_role AS ENUM ('super_admin', 'clinic_admin');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS admin_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role admin_role NOT NULL,
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS admin_users_email_idx ON admin_users(email);
    CREATE INDEX IF NOT EXISTS admin_users_tenant_id_idx ON admin_users(tenant_id);
  `);

  logger.info("admin_users table verified.");

  const defaultPasswordHash = await bcrypt.hash("Password@123", 10);

  // 1. Seed Super Admin
  await db
    .insert(adminUsers)
    .values({
      email: "superadmin@clinicconnect.com",
      passwordHash: defaultPasswordHash,
      name: "Platform Super Admin",
      role: "super_admin",
      tenantId: null,
      status: "active",
    })
    .onConflictDoUpdate({
      target: adminUsers.email,
      set: {
        passwordHash: defaultPasswordHash,
        role: "super_admin",
        status: "active",
      },
    });

  logger.info("Super Admin account seeded: superadmin@clinicconnect.com");

  // 2. Find existing tenants
  const allTenants = await db.query.tenants.findMany();

  for (const t of allTenants) {
    let email = "";
    if (t.name.toLowerCase().includes("sunrise")) {
      email = "admin@sunriseclinic.com";
    } else if (t.name.toLowerCase().includes("bang")) {
      email = "admin@bangclinic.com";
    } else {
      const slug = t.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
      email = `admin@${slug}.com`;
    }

    await db
      .insert(adminUsers)
      .values({
        email,
        passwordHash: defaultPasswordHash,
        name: `${t.name} Admin`,
        role: "clinic_admin",
        tenantId: t.id,
        status: "active",
      })
      .onConflictDoUpdate({
        target: adminUsers.email,
        set: {
          passwordHash: defaultPasswordHash,
          tenantId: t.id,
          role: "clinic_admin",
          status: "active",
        },
      });

    logger.info(`Clinic Admin account seeded: ${email} for ${t.name}`);
  }

  logger.info("Admin users seeding completed successfully!");
}

run()
  .catch((err) => {
    logger.error("Seeding failed", { err });
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
