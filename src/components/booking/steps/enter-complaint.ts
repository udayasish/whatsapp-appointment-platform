import type { StepContext, StepResult } from "../types.js";
import { buildConfirmSummary, confirmButtons, invalidReply } from "./shared.js";

export async function handleEnterComplaint(ctx: StepContext): Promise<StepResult> {
  const { lang, tempData, body } = ctx;
  const complaint = body.trim();

  if (complaint.length < 3 || complaint.length > 500) {
    return {
      nextStep: "enter_complaint",
      tempData,
      reply: invalidReply(lang, tempData),
    };
  }

  const nextTempData = { ...tempData, complaint };
  const reply = buildConfirmSummary(lang, nextTempData);

  return {
    nextStep: "confirm_booking",
    tempData: { ...nextTempData, lastPrompt: reply },
    reply,
    buttons: confirmButtons(lang),
  };
}
