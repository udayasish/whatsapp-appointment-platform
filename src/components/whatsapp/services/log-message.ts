import { db, messages, type MessageDirection } from "../../../lib/db/index.js";

export interface LogMessageParams {
  tenantId: string | null;
  direction: MessageDirection;
  fromNumber: string;
  toNumber: string;
  waMessageId?: string | null;
  messageType?: string;
  body?: string | null;
  mediaUrl?: string | null;
  rawPayload?: unknown;
  status?: string | null;
}

/**
 * Full audit log for every inbound/outbound message. `onConflictDoNothing`
 * makes this safe against Meta's at-least-once webhook redelivery (same
 * `wa_message_id` arriving twice).
 */
export async function logMessage(params: LogMessageParams) {
  const [message] = await db
    .insert(messages)
    .values({
      tenantId: params.tenantId ?? undefined,
      direction: params.direction,
      fromNumber: params.fromNumber,
      toNumber: params.toNumber,
      waMessageId: params.waMessageId ?? undefined,
      messageType: params.messageType ?? "text",
      body: params.body ?? undefined,
      mediaUrl: params.mediaUrl ?? undefined,
      rawPayload: params.rawPayload,
      status: params.status ?? undefined,
    })
    .onConflictDoNothing()
    .returning();
  return message ?? null;
}
