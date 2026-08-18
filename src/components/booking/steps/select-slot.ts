import { t } from "../messages.js";
import type { StepContext, StepResult } from "../types.js";
import { invalidReply, slotRowsFromTempData } from "./shared.js";

export async function handleSelectSlot(ctx: StepContext): Promise<StepResult> {
  const { lang, tempData, body } = ctx;
  const slotIds = tempData.slotIds ?? [];
  const slotStartTimes = tempData.slotStartTimes ?? [];
  const idx = Number(body.trim());

  if (!Number.isInteger(idx) || idx < 1 || idx > slotIds.length) {
    return {
      nextStep: "select_slot",
      tempData,
      reply: invalidReply(lang, tempData),
      list: {
        buttonLabel: t(lang, "chooseTimeButtonLabel"),
        rows: slotRowsFromTempData(tempData),
      },
    };
  }

  const slotId = slotIds[idx - 1]!;
  const slotStartTime = slotStartTimes[idx - 1]!;
  const reply = t(lang, "enterNamePrompt");

  return {
    nextStep: "enter_name",
    tempData: { ...tempData, slotId, slotStartTime, lastPrompt: reply },
    reply,
  };
}
