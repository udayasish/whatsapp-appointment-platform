import { logger } from "../../../lib/index.js";
import type { ConversationState } from "../../../lib/db/index.js";
import {
  getOrCreateConversationState,
  resetConversationState,
} from "./conversation-state.js";

/**
 * Checks if a mid-flow conversation state has exceeded the inactivity time window.
 * "idle" states are excluded because they are stationary waiting for user initiation.
 */
export function isSessionExpired(
  state: ConversationState,
  timeoutMinutes: number
): boolean {
  if (state.currentStep === "idle") {
    return false;
  }

  const lastActivity = new Date(state.updatedAt).getTime();
  const now = Date.now();
  const elapsedMinutes = (now - lastActivity) / (60 * 1000);

  return elapsedMinutes > timeoutMinutes;
}

export interface ActiveConversationResult {
  state: ConversationState;
  wasExpired: boolean;
}

/**
 * Retrieves the current conversation state for a patient.
 * If the patient abandoned an incomplete flow beyond the timeout window,
 * automatically resets their state to "idle" and clears intermediate tempData
 * so their next message starts with a clean greeting instead of an error.
 */
export async function getActiveConversationState(
  tenantId: string,
  phoneNumber: string,
  timeoutMinutes: number
): Promise<ActiveConversationResult> {
  const state = await getOrCreateConversationState(tenantId, phoneNumber);

  if (isSessionExpired(state, timeoutMinutes)) {
    const elapsedMinutes = Math.round(
      (Date.now() - new Date(state.updatedAt).getTime()) / (60 * 1000)
    );

    logger.info(
      "Conversation session expired due to inactivity. Resetting state to idle.",
      {
        tenantId,
        phoneNumber,
        abandonedStep: state.currentStep,
        elapsedMinutes,
        timeoutMinutes,
      }
    );

    await resetConversationState(state.id);

    return {
      state: {
        ...state,
        currentStep: "idle",
        tempData: {},
        updatedAt: new Date(),
      },
      wasExpired: true,
    };
  }

  return { state, wasExpired: false };
}
