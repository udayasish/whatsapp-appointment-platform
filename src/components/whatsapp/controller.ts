import type { Request, Response } from "express";
import { env, logger, withRetry } from "../../lib/index.js";
import { webhookVerifyQuerySchema } from "./schema.js";
import {
  applyStatusUpdate,
  handleInboundMessage,
  parseWebhookPayload,
} from "./services/index.js";

export function verifyWebhookHandler(req: Request, res: Response) {
  const query = webhookVerifyQuerySchema.parse(req.query);

  if (
    query["hub.mode"] === "subscribe" &&
    query["hub.verify_token"] === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  ) {
    res.status(200).send(query["hub.challenge"] ?? "");
    return;
  }
  res.sendStatus(403);
}

export async function receiveWebhookHandler(req: Request, res: Response) {
  // Ack immediately — Meta treats any non-2xx or slow response as a failure
  // and retries the entire payload.
  res.sendStatus(200);

  try {
    const { messages: inboundMessages, statuses } = parseWebhookPayload(
      req.body
    );
    logger.info("Received WhatsApp webhook payload", {
      messageCount: inboundMessages.length,
      statusCount: statuses.length,
    });

    for (const status of statuses) {
      await withRetry(() => applyStatusUpdate(status), 2, 300, (err, attempt) =>
        logger.warn(`Status update attempt ${attempt} failed`, { err })
      );
    }
    for (const inbound of inboundMessages) {
      // A dropped pooled DB connection is a one-off transient blip (not a
      // logic error) — retry once before accepting the message as lost.
      await withRetry(
        () => handleInboundMessage(inbound),
        2,
        300,
        (err, attempt) =>
          logger.warn(`Inbound message processing attempt ${attempt} failed`, {
            waMessageId: inbound.waMessageId,
            err,
          })
      );
    }
  } catch (err) {
    logger.error("Failed to process WhatsApp webhook payload", { err });
  }
}
