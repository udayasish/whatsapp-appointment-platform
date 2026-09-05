import { z } from "zod";

const metaMessageSchema = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  image: z.object({ id: z.string().optional(), caption: z.string().optional() }).optional(),
  document: z
    .object({
      id: z.string().optional(),
      filename: z.string().optional(),
      caption: z.string().optional(),
    })
    .optional(),
  button: z
    .object({ text: z.string().optional(), payload: z.string().optional() })
    .optional(),
  // Sent when a user taps a reply button or selects a list row.
  interactive: z
    .object({
      type: z.enum(["button_reply", "list_reply"]),
      button_reply: z.object({ id: z.string(), title: z.string() }).optional(),
      list_reply: z
        .object({ id: z.string(), title: z.string(), description: z.string().optional() })
        .optional(),
    })
    .optional(),
});

const metaStatusSchema = z.object({
  id: z.string(),
  status: z.string(),
  timestamp: z.string(),
});

const metaChangeValueSchema = z.object({
  metadata: z.object({
    display_phone_number: z.string().optional(),
    phone_number_id: z.string(),
  }),
  messages: z.array(metaMessageSchema).optional(),
  statuses: z.array(metaStatusSchema).optional(),
});

const metaWebhookSchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          value: metaChangeValueSchema,
        })
      ),
    })
  ),
});

export interface ParsedInboundMessage {
  phoneNumberId: string;
  from: string;
  waMessageId: string;
  messageType: string;
  timestamp: number;
  body: string | null;
  mediaId: string | null;
  raw: unknown;
}

export interface ParsedStatusUpdate {
  phoneNumberId: string;
  waMessageId: string;
  status: string;
}

function extractBody(msg: z.infer<typeof metaMessageSchema>): string | null {
  if (msg.type === "text" && msg.text) return msg.text.body;
  if (msg.type === "button" && msg.button) {
    return msg.button.text ?? msg.button.payload ?? null;
  }
  // Document/image captions carry the staff command text (e.g. "REPORT <phone>").
  if (msg.type === "document" && msg.document) return msg.document.caption ?? null;
  if (msg.type === "image" && msg.image) return msg.image.caption ?? null;
  // A tapped reply button/list row is treated as if the user typed its id —
  // step handlers parse "1"/"2"/"yes"/"cancel" the same way either way.
  if (msg.type === "interactive" && msg.interactive) {
    return msg.interactive.button_reply?.id ?? msg.interactive.list_reply?.id ?? null;
  }
  return null;
}

function extractMediaId(msg: z.infer<typeof metaMessageSchema>): string | null {
  if (msg.type === "image" && msg.image) return msg.image.id ?? null;
  if (msg.type === "document" && msg.document) return msg.document.id ?? null;
  return null;
}

/**
 * Normalizes a raw Meta WhatsApp Cloud API webhook payload into flat message
 * and status-update lists. Unparseable payloads (unexpected shape) yield
 * empty arrays rather than throwing — inbound webhooks must always 200.
 */
export function parseWebhookPayload(rawBody: unknown): {
  messages: ParsedInboundMessage[];
  statuses: ParsedStatusUpdate[];
} {
  const parsed = metaWebhookSchema.safeParse(rawBody);
  if (!parsed.success) return { messages: [], statuses: [] };

  const messagesOut: ParsedInboundMessage[] = [];
  const statusesOut: ParsedStatusUpdate[] = [];

  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      const { value } = change;
      const phoneNumberId = value.metadata.phone_number_id;

      for (const msg of value.messages ?? []) {
        messagesOut.push({
          phoneNumberId,
          from: msg.from,
          waMessageId: msg.id,
          messageType: msg.type,
          timestamp: parseInt(msg.timestamp, 10) || Math.floor(Date.now() / 1000),
          body: extractBody(msg),
          mediaId: extractMediaId(msg),
          raw: msg,
        });
      }

      for (const status of value.statuses ?? []) {
        statusesOut.push({
          phoneNumberId,
          waMessageId: status.id,
          status: status.status,
        });
      }
    }
  }

  return { messages: messagesOut, statuses: statusesOut };
}
