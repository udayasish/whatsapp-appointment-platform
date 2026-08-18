import { logger, withKeyLock } from "../../../lib/index.js";
import { resolveTenantByPhoneNumberId } from "./resolve-tenant.js";
import { resolveSenderRole } from "./resolve-role.js";
import { logMessage } from "./log-message.js";
import { routeInboundMessage } from "./message-router.js";
import type { ParsedInboundMessage } from "./parse-inbound.js";

export async function handleInboundMessage(inbound: ParsedInboundMessage) {
  // Serialize per (whatsapp number, sender) — Meta does not guarantee
  // in-order webhook delivery, and a retried/delayed message racing a later
  // one would otherwise read-modify-write conversation_state out of order.
  // Keyed on the raw phone_number_id (not the resolved tenant id) since
  // that's available before any DB call, so even a slow tenant lookup for
  // one message blocks a later message for the same sender behind it.
  return withKeyLock(`${inbound.phoneNumberId}:${inbound.from}`, () =>
    processInboundMessage(inbound)
  );
}

async function processInboundMessage(inbound: ParsedInboundMessage) {
  const tenant = await resolveTenantByPhoneNumberId(inbound.phoneNumberId);

  if (!tenant) {
    // Nothing is silently dropped even when the tenant can't be resolved.
    logger.warn("Inbound WhatsApp message for unknown phone_number_id", {
      phoneNumberId: inbound.phoneNumberId,
      from: inbound.from,
    });
    await logMessage({
      tenantId: null,
      direction: "inbound",
      fromNumber: inbound.from,
      toNumber: inbound.phoneNumberId,
      waMessageId: inbound.waMessageId,
      messageType: inbound.messageType,
      body: inbound.body,
      mediaUrl: inbound.mediaId,
      rawPayload: inbound.raw,
    });
    return;
  }

  const resolved = await resolveSenderRole(tenant.id, inbound.from);

  await logMessage({
    tenantId: tenant.id,
    direction: "inbound",
    fromNumber: inbound.from,
    toNumber: tenant.whatsappPhoneNumberId,
    waMessageId: inbound.waMessageId,
    messageType: inbound.messageType,
    body: inbound.body,
    mediaUrl: inbound.mediaId,
    rawPayload: inbound.raw,
  });

  await routeInboundMessage({
    tenant,
    role: resolved.role,
    user: resolved.user,
    phoneNumber: inbound.from,
    messageType: inbound.messageType,
    body: inbound.body,
    mediaId: inbound.mediaId,
    raw: inbound.raw,
  });
}
