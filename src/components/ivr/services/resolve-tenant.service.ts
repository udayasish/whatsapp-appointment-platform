import { eq, isNotNull } from "drizzle-orm";
import { db, tenants } from "../../../lib/db/index.js";

export async function resolveTenantByIvrPhone(phoneNumber: string) {
  if (!phoneNumber) return null;

  // 1. Try exact match
  const [exactMatch] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.ivrPhoneNumber, phoneNumber))
    .limit(1);

  if (exactMatch) return exactMatch;

  // 2. Try normalized 10-digit suffix match
  const digitsOnly = phoneNumber.replace(/\D/g, "");
  const last10 = digitsOnly.slice(-10);

  const allTenantsWithIvr = await db
    .select()
    .from(tenants)
    .where(isNotNull(tenants.ivrPhoneNumber));

  const matched = allTenantsWithIvr.find((t) => {
    if (!t.ivrPhoneNumber) return false;
    const tDigits = t.ivrPhoneNumber.replace(/\D/g, "");
    return tDigits === digitsOnly || (last10.length === 10 && tDigits.slice(-10) === last10);
  });

  return matched ?? null;
}
