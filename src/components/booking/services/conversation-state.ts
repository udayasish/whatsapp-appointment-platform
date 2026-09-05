import { and, eq } from "drizzle-orm";
import {
  conversationState,
  db,
  type ConversationState,
  type ConversationStep,
} from "../../../lib/db/index.js";

export async function getOrCreateConversationState(
  tenantId: string,
  phoneNumber: string
): Promise<ConversationState> {
  const existing = await db.query.conversationState.findFirst({
    where: and(
      eq(conversationState.tenantId, tenantId),
      eq(conversationState.phoneNumber, phoneNumber)
    ),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(conversationState)
    .values({ tenantId, phoneNumber })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  // Lost the insert race to a concurrent message from the same sender.
  const row = await db.query.conversationState.findFirst({
    where: and(
      eq(conversationState.tenantId, tenantId),
      eq(conversationState.phoneNumber, phoneNumber)
    ),
  });
  if (!row) throw new Error("Failed to get or create conversation state");
  return row;
}

export async function updateConversationState(
  id: string,
  currentStep: ConversationStep,
  tempData: Record<string, unknown>
): Promise<void> {
  await db
    .update(conversationState)
    .set({ currentStep, tempData, updatedAt: new Date() })
    .where(eq(conversationState.id, id));
}

export async function resetConversationState(id: string): Promise<void> {
  await updateConversationState(id, "idle", {});
}
