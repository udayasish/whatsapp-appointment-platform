import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { commonFields } from "./common.js";
import { conversationStepEnum } from "./enums.js";
import { tenants } from "./tenants.js";

// One row per (tenant, phone number) tracks where a patient is in the
// booking-bot ladder. `tempData` holds mid-flow selections (doctor id, date,
// slot id, name, age, complaint) until COMPLETED writes the appointment.
export const conversationState = pgTable(
  "conversation_state",
  {
    ...commonFields,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
    currentStep: conversationStepEnum("current_step").notNull().default("idle"),
    tempData: jsonb("temp_data").notNull().default({}),
  },
  (t) => [
    unique("conversation_state_tenant_phone_unique").on(
      t.tenantId,
      t.phoneNumber
    ),
    index("conversation_state_phone_number_idx").on(t.phoneNumber),
  ]
);

export const conversationStateRelations = relations(
  conversationState,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [conversationState.tenantId],
      references: [tenants.id],
    }),
  })
);

export type ConversationState = typeof conversationState.$inferSelect;
