import { eq } from "drizzle-orm";
import { db, tenants, type Tenant } from "../../../lib/db/index.js";

/**
 * Meta sends every tenant's webhooks to the same URL — the tenant is
 * resolved from `metadata.phone_number_id` in the payload (the WhatsApp
 * number that was messaged), never from the URL or headers.
 */
export async function resolveTenantByPhoneNumberId(
  phoneNumberId: string
): Promise<Tenant | null> {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.whatsappPhoneNumberId, phoneNumberId),
  });
  return tenant ?? null;
}
