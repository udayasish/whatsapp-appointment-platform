import type { ConversationStep } from "../../../lib/db/index.js";
import { t } from "../messages.js";
import type { StepContext, StepResult } from "../types.js";
import {
  actionButtons,
  buildDateListPrompt,
  buildDoctorListPrompt,
  buildSlotListPrompt,
  languageButtons,
} from "./shared.js";

/**
 * Regenerates the prompt for the step before `currentStep`. Most steps only
 * store the fields they themselves set, so going back sometimes means
 * re-fetching a list (e.g. doctors, dates, slots) rather than reading it
 * back out of tempData — see select-doctor.ts, which replaces tempData
 * wholesale and drops the cached doctor list on its way to select_date.
 */
export async function handleGoBack(
  currentStep: ConversationStep,
  ctx: StepContext
): Promise<StepResult> {
  const { lang, tempData, tenant } = ctx;

  switch (currentStep) {
    case "idle":
    case "select_language":
      return {
        nextStep: currentStep,
        tempData,
        reply: `${t(lang, "nothingToGoBackTo")}\n\n${tempData.lastPrompt ?? ""}`,
      };

    case "select_action": {
      const reply = t("en", "languagePrompt", { clinicName: tenant.name });
      return {
        nextStep: "select_language",
        tempData: { lastPrompt: reply },
        reply,
        buttons: languageButtons(),
      };
    }

    case "select_doctor": {
      const reply = t(lang, "actionPrompt");
      return {
        nextStep: "select_action",
        tempData: { lang, lastPrompt: reply },
        reply,
        buttons: actionButtons(lang),
      };
    }

    case "select_date": {
      const prompt = await buildDoctorListPrompt(tenant.id, lang);
      if (!prompt) return { nextStep: "idle", tempData: {}, reply: t(lang, "noDoctors") };
      return {
        nextStep: "select_doctor",
        tempData: {
          lang,
          doctorIds: prompt.doctorIds,
          doctorNames: prompt.doctorNames,
          doctorSpecializations: prompt.doctorSpecializations,
          lastPrompt: prompt.reply,
        },
        reply: prompt.reply,
        list: { buttonLabel: prompt.buttonLabel, rows: prompt.rows },
      };
    }

    case "select_slot": {
      const doctorId = tempData.doctorId!;
      const prompt = await buildDateListPrompt(doctorId, lang);
      if (!prompt) return { nextStep: "idle", tempData: {}, reply: t(lang, "noDates") };
      return {
        nextStep: "select_date",
        tempData: {
          lang,
          doctorId,
          doctorName: tempData.doctorName,
          dates: prompt.dates,
          lastPrompt: prompt.reply,
        },
        reply: prompt.reply,
        list: { buttonLabel: prompt.buttonLabel, rows: prompt.rows },
      };
    }

    case "enter_name": {
      const doctorId = tempData.doctorId!;
      const date = tempData.date!;
      const prompt = await buildSlotListPrompt(doctorId, date, lang);
      if (!prompt) return { nextStep: "idle", tempData: {}, reply: t(lang, "noSlots") };
      return {
        nextStep: "select_slot",
        tempData: {
          ...tempData,
          slotIds: prompt.slotIds,
          slotStartTimes: prompt.slotStartTimes,
          slotId: undefined,
          slotStartTime: undefined,
          patientName: undefined,
          lastPrompt: prompt.reply,
        },
        reply: prompt.reply,
        list: { buttonLabel: prompt.buttonLabel, rows: prompt.rows },
      };
    }

    case "enter_age": {
      const reply = t(lang, "enterNamePrompt");
      return {
        nextStep: "enter_name",
        tempData: { ...tempData, patientName: undefined, lastPrompt: reply },
        reply,
      };
    }

    case "enter_complaint": {
      const reply = t(lang, "enterAgePrompt");
      return {
        nextStep: "enter_age",
        tempData: { ...tempData, patientAge: undefined, lastPrompt: reply },
        reply,
      };
    }

    case "confirm_booking": {
      const reply = t(lang, "enterComplaintPrompt");
      return {
        nextStep: "enter_complaint",
        tempData: { ...tempData, complaint: undefined, lastPrompt: reply },
        reply,
      };
    }

    case "completed":
    case "cancelled":
      return { nextStep: "idle", tempData: {}, reply: t(lang, "nothingToGoBackTo") };
  }
}
