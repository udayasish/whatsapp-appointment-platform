import { t } from "../messages.js";
import type { Lang, StepContext, StepResult } from "../types.js";
import { actionButtons, invalidReply, languageButtons } from "./shared.js";

export async function handleSelectLanguage(ctx: StepContext): Promise<StepResult> {
  const choice = ctx.body.trim();
  let lang: Lang | null = null;
  if (choice === "1") lang = "en";
  else if (choice === "2") lang = "as";

  if (!lang) {
    return {
      nextStep: "select_language",
      tempData: ctx.tempData,
      reply: invalidReply("en", ctx.tempData),
      buttons: languageButtons(),
    };
  }

  const reply = t(lang, "actionPrompt");
  return {
    nextStep: "select_action",
    tempData: { lang, lastPrompt: reply },
    reply,
    buttons: actionButtons(lang),
  };
}
