import { t } from "../messages.js";
import type { StepContext, StepResult } from "../types.js";
import { invalidReply } from "./shared.js";

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

  const reply = t(lang, "enterComplaintPrompt");
  return {
    nextStep: "enter_complaint",
    tempData: { ...tempData, patientAge: age, lastPrompt: reply },
    reply,
  };
}
