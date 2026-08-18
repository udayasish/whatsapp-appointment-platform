import type { InboundMessageContext } from "../whatsapp/services/message-router.js";
import {
  sendInteractiveButtonsMessage,
  sendInteractiveListMessage,
  sendTextMessage,
} from "../whatsapp/services/index.js";
import type { ConversationStep } from "../../lib/db/index.js";
import {
  getOrCreateConversationState,
  getOrCreatePatient,
  resetConversationState,
  updateConversationState,
} from "./services/index.js";
import {
  handleConfirmBooking,
  handleEnterAge,
  handleEnterComplaint,
  handleEnterName,
  handleGoBack,
  handleIdle,
  handleSelectAction,
  handleSelectDate,
  handleSelectDoctor,
  handleSelectLanguage,
  handleSelectSlot,
} from "./steps/index.js";
import { t } from "./messages.js";
import type { BookingTempData, Lang, StepContext, StepResult } from "./types.js";

async function dispatchStep(
  step: ConversationStep,
  ctx: StepContext
): Promise<StepResult> {
  switch (step) {
    case "idle":
      return handleIdle(ctx);
    case "select_language":
      return handleSelectLanguage(ctx);
    case "select_action":
      return handleSelectAction(ctx);
    case "select_doctor":
      return handleSelectDoctor(ctx);
    case "select_date":
      return handleSelectDate(ctx);
    case "select_slot":
      return handleSelectSlot(ctx);
    case "enter_name":
      return handleEnterName(ctx);
    case "enter_age":
      return handleEnterAge(ctx);
    case "enter_complaint":
      return handleEnterComplaint(ctx);
    case "confirm_booking":
      return handleConfirmBooking(ctx);
    case "completed":
    case "cancelled":
      // Terminal states are reset to idle immediately after being reached,
      // so reads should never observe them — fall back safely if one is seen.
      return handleIdle(ctx);
  }
}

export async function handleBookingMessage(ctx: InboundMessageContext): Promise<void> {
  const reply = (body: string, buttons?: StepResult["buttons"], list?: StepResult["list"]) => {
    if (buttons) {
      return sendInteractiveButtonsMessage({
        tenantId: ctx.tenant.id,
        phoneNumberId: ctx.tenant.whatsappPhoneNumberId,
        to: ctx.phoneNumber,
        body,
        buttons,
      });
    }
    if (list) {
      return sendInteractiveListMessage({
        tenantId: ctx.tenant.id,
        phoneNumberId: ctx.tenant.whatsappPhoneNumberId,
        to: ctx.phoneNumber,
        body,
        buttonLabel: list.buttonLabel,
        rows: list.rows,
      });
    }
    return sendTextMessage({
      tenantId: ctx.tenant.id,
      phoneNumberId: ctx.tenant.whatsappPhoneNumberId,
      to: ctx.phoneNumber,
      body,
    });
  };

  // "text" covers typed replies; "interactive" covers a tapped reply button —
  // parse-inbound.ts surfaces the tapped button's id as `body` either way.
  if ((ctx.messageType !== "text" && ctx.messageType !== "interactive") || ctx.body === null) {
    await reply("Sorry, I can only understand text messages right now. Please reply with text.");
    return;
  }

  const body = ctx.body.trim();
  const patient = await getOrCreatePatient(ctx.tenant.id, ctx.phoneNumber, ctx.user);
  const state = await getOrCreateConversationState(ctx.tenant.id, ctx.phoneNumber);
  const tempData = (state.tempData ?? {}) as BookingTempData;
  const lang: Lang = tempData.lang ?? "en";

  // "cancel" works at any point in an active flow — idle has nothing in
  // progress to cancel, so it's excluded (any message there just starts a
  // fresh flow via handleIdle).
  if (state.currentStep !== "idle" && /^cancel$/i.test(body)) {
    await resetConversationState(state.id);
    await reply(t(lang, "cancelled"));
    return;
  }

  const stepCtx: StepContext = {
    tenant: ctx.tenant,
    patient,
    lang,
    tempData,
    body,
  };

  // "back" undoes the current step's selection and re-shows the previous
  // step's prompt — mirrors the "cancel" interception above, and is
  // similarly excluded at idle since there's nothing to undo yet.
  if (state.currentStep !== "idle" && /^back$/i.test(body)) {
    const result = await handleGoBack(state.currentStep, stepCtx);
    await updateConversationState(
      state.id,
      result.nextStep,
      result.tempData as unknown as Record<string, unknown>
    );
    await reply(result.reply, result.buttons, result.list);
    return;
  }

  const result = await dispatchStep(state.currentStep, stepCtx);

  await updateConversationState(
    state.id,
    result.nextStep,
    result.tempData as unknown as Record<string, unknown>
  );
  await reply(result.reply, result.buttons, result.list);
}
