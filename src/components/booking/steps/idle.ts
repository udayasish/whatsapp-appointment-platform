import { t } from "../messages.js";
import type { StepContext, StepResult } from "../types.js";
import { languageButtons } from "./shared.js";

/** Any message while idle starts a fresh flow — always begins with language selection. */
export async function handleIdle(ctx: StepContext): Promise<StepResult> {
  const reply = t("en", "languagePrompt", { clinicName: ctx.tenant.name });
  return {
    nextStep: "select_language",
    tempData: { lastPrompt: reply },
    reply,
    buttons: languageButtons(),
  };
}
