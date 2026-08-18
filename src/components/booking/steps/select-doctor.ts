import { t } from "../messages.js";
import type { StepContext, StepResult } from "../types.js";
import { buildDateListPrompt, doctorRowsFromTempData, invalidReply } from "./shared.js";

export async function handleSelectDoctor(ctx: StepContext): Promise<StepResult> {
  const { lang, tempData, body } = ctx;
  const ids = tempData.doctorIds ?? [];
  const names = tempData.doctorNames ?? [];
  const idx = Number(body.trim());

  if (!Number.isInteger(idx) || idx < 1 || idx > ids.length) {
    return {
      nextStep: "select_doctor",
      tempData,
      reply: invalidReply(lang, tempData),
      list: {
        buttonLabel: t(lang, "chooseDoctorButtonLabel"),
        rows: doctorRowsFromTempData(tempData),
      },
    };
  }

  const doctorId = ids[idx - 1]!;
  const doctorName = names[idx - 1]!;

  const prompt = await buildDateListPrompt(doctorId, lang);
  if (!prompt) {
    return { nextStep: "idle", tempData: {}, reply: t(lang, "noDates") };
  }

  return {
    nextStep: "select_date",
    tempData: {
      lang,
      doctorId,
      doctorName,
      dates: prompt.dates,
      lastPrompt: prompt.reply,
    },
    reply: prompt.reply,
    list: { buttonLabel: prompt.buttonLabel, rows: prompt.rows },
  };
}
