import { t } from "../messages.js";
import type { StepContext, StepResult } from "../types.js";
import { invalidReply } from "./shared.js";

export async function handleEnterName(ctx: StepContext): Promise<StepResult> {
  const { lang, tempData, body } = ctx;
  const name = body.trim();

  if (name.length < 2 || name.length > 100 || /^\d+$/.test(name)) {
    return {
      nextStep: "enter_name",
      tempData,
      reply: invalidReply(lang, tempData),
    };
  }

  const reply = t(lang, "enterAgePrompt");
  return {
    nextStep: "enter_age",
    tempData: { ...tempData, patientName: name, lastPrompt: reply },
    reply,
  };
}
