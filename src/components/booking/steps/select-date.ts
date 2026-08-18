import { t } from "../messages.js";
import type { StepContext, StepResult } from "../types.js";
import {
  buildDateListPrompt,
  buildSlotListPrompt,
  dateRowsFromTempData,
  invalidReply,
} from "./shared.js";

export async function handleSelectDate(ctx: StepContext): Promise<StepResult> {
  const { lang, tempData, body } = ctx;
  const dates = tempData.dates ?? [];
  const idx = Number(body.trim());

  if (!Number.isInteger(idx) || idx < 1 || idx > dates.length) {
    return {
      nextStep: "select_date",
      tempData,
      reply: invalidReply(lang, tempData),
      list: {
        buttonLabel: t(lang, "chooseDateButtonLabel"),
        rows: dateRowsFromTempData(tempData),
      },
    };
  }

  const date = dates[idx - 1]!;
  const doctorId = tempData.doctorId!;

  const slotPrompt = await buildSlotListPrompt(doctorId, date, lang);
  if (!slotPrompt) {
    // Slots on this date were taken by the time it was picked — refresh the
    // date list and stay on the same step rather than dead-ending.
    const datePrompt = await buildDateListPrompt(doctorId, lang);
    if (!datePrompt) {
      return { nextStep: "idle", tempData: {}, reply: t(lang, "noDates") };
    }
    return {
      nextStep: "select_date",
      tempData: { ...tempData, dates: datePrompt.dates, lastPrompt: datePrompt.reply },
      reply: `${t(lang, "noSlots")}\n\n${datePrompt.reply}`,
      list: { buttonLabel: datePrompt.buttonLabel, rows: datePrompt.rows },
    };
  }

  return {
    nextStep: "select_slot",
    tempData: {
      ...tempData,
      date,
      slotIds: slotPrompt.slotIds,
      slotStartTimes: slotPrompt.slotStartTimes,
      lastPrompt: slotPrompt.reply,
    },
    reply: slotPrompt.reply,
    list: { buttonLabel: slotPrompt.buttonLabel, rows: slotPrompt.rows },
  };
}
