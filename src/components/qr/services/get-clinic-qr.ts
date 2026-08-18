import { eq, or } from "drizzle-orm";
import { db, tenants } from "../../../lib/db/index.js";
import {
  generateWaMeLink,
  sanitizePhoneNumber,
} from "../../../common/wa-link.js";
import { generateQrDataUrl } from "./generate-qr.js";
import type { ClinicQrInfo } from "../types.js";

/**
 * Fetches tenant details by UUID, WhatsApp Phone Number ID, or Display Number.
 * If identifier is omitted, returns the first active clinic.
 */
export async function getClinicQrInfo(
  identifier?: string,
  messageText = "Book appointment",
): Promise<ClinicQrInfo | null> {
  let tenant = null;

  if (identifier && identifier.trim() !== "" && identifier !== "default") {
    const cleanId = identifier.trim();
    // Try matching id (UUID), whatsappPhoneNumberId, or whatsappDisplayNumber
    tenant = await db.query.tenants.findFirst({
      where: or(
        eq(tenants.id, cleanId),
        eq(tenants.whatsappPhoneNumberId, cleanId),
        eq(tenants.whatsappDisplayNumber, cleanId),
      ),
    });
  } else {
    // Default fallback: get the first active clinic
    tenant = await db.query.tenants.findFirst({
      where: eq(tenants.status, "active"),
    });
  }

  if (!tenant) {
    return null;
  }

  const cleanPhone = sanitizePhoneNumber(tenant.whatsappDisplayNumber);
  const waMeUrl = generateWaMeLink({ phone: cleanPhone, text: messageText });
  const qrDataUrl = await generateQrDataUrl(waMeUrl, {
    width: 600,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  return {
    tenantId: tenant.id,
    clinicName: tenant.name,
    displayNumber: tenant.whatsappDisplayNumber,
    cleanPhone,
    waMeUrl,
    qrDataUrl,
  };
}
