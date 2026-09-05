import type { StepContext, StepResult } from "../types.js";
import { buildConfirmSummary, confirmButtons, invalidReply } from "./shared.js";

export async function handleEnterAge(ctx: StepContext): Promise<StepResult> {
  const { lang, tempData, body } = ctx;
  const age = Number(body.trim());

  if (!Number.isInteger(age) || age < 0 || age > 120) {
    return {
      nextStep: "enter_age",
      tempData,
      reply: invalidReply(lang, tempData),
    };
  }

  const nextTempData = { ...tempData, patientAge: age };
  const summary = buildConfirmSummary(lang, nextTempData);

  return {
    nextStep: "confirm_booking",
    tempData: { ...nextTempData, lastPrompt: summary },
    reply: summary,
    buttons: confirmButtons(lang),
  };
}
