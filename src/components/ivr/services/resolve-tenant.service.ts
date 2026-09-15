import { eq } from "drizzle-orm";
import { db, tenants } from "../../../lib/db/index.js";

export async function resolveTenantByIvrPhone(phoneNumber: string) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.ivrPhoneNumber, phoneNumber))
    .limit(1);
  return tenant ?? null;
}
