// src/components/admin/services/login.ts
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, adminUsers } from "../../../lib/db/index.js";

const INVALID_CREDENTIALS_MSG = "Invalid email or password";

/**
 * Validates credentials and returns the admin user (without password hash).
 * Throws 401 on any mismatch — same generic message to prevent email enumeration.
 */
export const loginAdmin = async (
  email: string,
  password: string
) => {
  const results = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email.trim().toLowerCase()))
    .limit(1);

  const user = results[0];

  // Use a dummy compare if user not found to prevent timing attacks
  if (!user) {
    await bcrypt.compare(password, "$2a$10$dummyhashtopreventtimingattacks00000000000000000");
    const err = new Error(INVALID_CREDENTIALS_MSG) as Error & { status: number };
    err.status = 401;
    throw err;
  }

  if (user.status !== "active") {
    const err = new Error("Your account has been suspended") as Error & { status: number };
    err.status = 403;
    throw err;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    const err = new Error(INVALID_CREDENTIALS_MSG) as Error & { status: number };
    err.status = 401;
    throw err;
  }

  // Return user without the password hash
  const { passwordHash: _omit, ...safeUser } = user;
  return safeUser;
};
