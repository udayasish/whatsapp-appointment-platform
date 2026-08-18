import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { commonFields } from "./common.js";
import { messageDirectionEnum } from "./enums.js";
import { tenants } from "./tenants.js";

// Full audit log of every inbound/outbound WhatsApp message. `tenantId` is
// nullable because inbound messages are logged even when tenant resolution
// fails (unknown phone_number_id) so nothing is silently dropped.
export const messages = pgTable(
  "messages",
  {
    ...commonFields,
    tenantId: uuid("tenant_id").references(() => tenants.id),
    direction: messageDirectionEnum("direction").notNull(),
    fromNumber: varchar("from_number", { length: 20 }).notNull(),
    toNumber: varchar("to_number", { length: 20 }).notNull(),
    waMessageId: varchar("wa_message_id", { length: 128 }).unique(),
    messageType: varchar("message_type", { length: 32 })
      .notNull()
      .default("text"),
    body: text("body"),
    mediaUrl: varchar("media_url", { length: 1000 }),
    rawPayload: jsonb("raw_payload"),
    // Delivery status for outbound messages (sent/delivered/read/failed),
    // updated by Meta's status webhooks.
    status: varchar("status", { length: 32 }),
  },
  (t) => [
    index("messages_tenant_id_idx").on(t.tenantId),
    index("messages_from_number_idx").on(t.fromNumber),
  ]
);

export const messagesRelations = relations(messages, ({ one }) => ({
  tenant: one(tenants, {
    fields: [messages.tenantId],
    references: [tenants.id],
  }),
}));

export type Message = typeof messages.$inferSelect;
