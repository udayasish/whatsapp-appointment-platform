import axios from "axios";
import { env, BadGatewayError } from "../../../lib/index.js";
import logger from "../../../lib/logger.js";
import { logMessage } from "./log-message.js";

export interface SendWhatsAppMessageParams {
  tenantId: string;
  /** The tenant's own WhatsApp phone_number_id — the Graph API sends "from" this. */
  phoneNumberId: string;
  to: string;
  payload: Record<string, unknown>;
}

interface GraphSendResponse {
  messages?: { id: string }[];
}

function extractTextBody(payload: Record<string, unknown>): string | null {
  const text = payload["text"];
  if (
    typeof text === "object" &&
    text !== null &&
    "body" in text &&
    typeof (text as { body: unknown }).body === "string"
  ) {
    return (text as { body: string }).body;
  }
  return null;
}

/**
 * The one function every component uses to send a WhatsApp message. Wraps
 * the Graph API call and logs the outbound message (with the wa_message_id
 * Meta returns) to the same audit trail inbound messages go through.
 */
export async function sendWhatsAppMessage(
  params: SendWhatsAppMessageParams
): Promise<string | null> {
  const { tenantId, phoneNumberId, to, payload } = params;
  const url = `${env.WHATSAPP_GRAPH_API_BASE_URL}/${env.WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
  const body = { messaging_product: "whatsapp", to, ...payload };

  let data: GraphSendResponse;
  try {
    const response = await axios.post<GraphSendResponse>(url, body, {
      headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
      timeout: 10_000,
    });
    data = response.data;
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? JSON.stringify(err.response?.data)
      : String(err);
    logger.error("WhatsApp Graph API call failed", { detail, to, phoneNumberId });
    throw new BadGatewayError("Failed to send WhatsApp message");
  }

  const waMessageId = data.messages?.[0]?.id ?? null;

  await logMessage({
    tenantId,
    direction: "outbound",
    fromNumber: phoneNumberId,
    toNumber: to,
    waMessageId,
    messageType: typeof payload["type"] === "string" ? (payload["type"] as string) : "text",
    body: extractTextBody(payload),
    rawPayload: payload,
  });

  return waMessageId;
}

export async function sendTextMessage(params: {
  tenantId: string;
  phoneNumberId: string;
  to: string;
  body: string;
}): Promise<string | null> {
  return sendWhatsAppMessage({
    tenantId: params.tenantId,
    phoneNumberId: params.phoneNumberId,
    to: params.to,
    payload: { type: "text", text: { body: params.body } },
  });
}

/**
 * Sends a tap-to-select message with up to 3 reply buttons. A regular
 * session message (no template approval needed) — the reply arrives on the
 * webhook as `interactive.button_reply.id`, which parse-inbound.ts surfaces
 * as `body`, same as if the user had typed it.
 */
export async function sendInteractiveButtonsMessage(params: {
  tenantId: string;
  phoneNumberId: string;
  to: string;
  body: string;
  buttons: { id: string; title: string }[];
}): Promise<string | null> {
  return sendWhatsAppMessage({
    tenantId: params.tenantId,
    phoneNumberId: params.phoneNumberId,
    to: params.to,
    payload: {
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: params.body },
        action: {
          buttons: params.buttons.map((b) => ({
            type: "reply",
            reply: { id: b.id, title: b.title },
          })),
        },
      },
    },
  });
}

/**
 * Sends a tap-to-select message with up to 10 rows in a single dropdown
 * list. Same regular-session-message rules as sendInteractiveButtonsMessage
 * — the tapped row arrives as `interactive.list_reply.id`, surfaced as
 * `body` by parse-inbound.ts.
 */
export async function sendInteractiveListMessage(params: {
  tenantId: string;
  phoneNumberId: string;
  to: string;
  body: string;
  buttonLabel: string;
  rows: { id: string; title: string; description?: string }[];
}): Promise<string | null> {
  return sendWhatsAppMessage({
    tenantId: params.tenantId,
    phoneNumberId: params.phoneNumberId,
    to: params.to,
    payload: {
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: params.body },
        action: {
          button: params.buttonLabel,
          sections: [
            {
              rows: params.rows.map((r) => ({
                id: r.id,
                title: r.title,
                description: r.description,
              })),
            },
          ],
        },
      },
    },
  });
}

/**
 * Sends an approved WhatsApp message template. Required for any
 * business-initiated message outside the 24-hour customer service window
 * (reminders, staff alerts) — Meta rejects free-form text there. Template
 * name/language/components must match what was registered and approved on
 * the WABA (see src/components/whatsapp/templates.ts).
 */
export async function sendTemplateMessage(params: {
  tenantId: string;
  phoneNumberId: string;
  to: string;
  templateName: string;
  languageCode: string;
  components: { type: string; parameters?: unknown[] }[];
}): Promise<string | null> {
  return sendWhatsAppMessage({
    tenantId: params.tenantId,
    phoneNumberId: params.phoneNumberId,
    to: params.to,
    payload: {
      type: "template",
      template: {
        name: params.templateName,
        language: { code: params.languageCode },
        components: params.components,
      },
    },
  });
}
