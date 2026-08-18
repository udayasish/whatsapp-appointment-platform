import { listUpcomingAppointmentsForPatient } from "../../appointments/services/index.js";
import { formatDateLong, formatTime12h } from "../../../common/format.js";
import { t } from "../messages.js";
import type { StepContext, StepResult } from "../types.js";
import { actionButtons, buildDoctorListPrompt, invalidReply } from "./shared.js";

export async function handleSelectAction(ctx: StepContext): Promise<StepResult> {
  const { lang, tempData, body, tenant, patient } = ctx;
  const choice = body.trim();

  if (choice === "2") {
    const upcoming = await listUpcomingAppointmentsForPatient(patient.id);
    const reply =
      upcoming.length === 0
        ? t(lang, "noUpcomingAppointments")
        : t(lang, "viewAppointmentsHeader") +
          "\n\n" +
          upcoming
            .map(
              (a) =>
                `🎫 *#${a.tokenNumber}* — Dr. ${a.doctorName}, ${formatDateLong(a.appointmentDate)} ${formatTime12h(a.appointmentTime)}`
            )
            .join("\n");
    return { nextStep: "idle", tempData: {}, reply };
  }

  if (choice === "1") {
    const prompt = await buildDoctorListPrompt(tenant.id, lang);
    if (!prompt) {
      return { nextStep: "idle", tempData: {}, reply: t(lang, "noDoctors") };
    }
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

  return {
    nextStep: "select_action",
    tempData,
    reply: invalidReply(lang, tempData),
    buttons: actionButtons(lang),
  };
}
