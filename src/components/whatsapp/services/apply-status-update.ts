import { eq } from "drizzle-orm";
import { db, messages } from "../../../lib/db/index.js";
import type { ParsedStatusUpdate } from "./parse-inbound.js";

/** Applies a delivery-status webhook (sent/delivered/read/failed) to the logged message. */
export async function applyStatusUpdate(update: ParsedStatusUpdate) {
  await db
    .update(messages)
    .set({ status: update.status })
    .where(eq(messages.waMessageId, update.waMessageId));
}
