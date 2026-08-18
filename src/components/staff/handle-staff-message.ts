import { sendTextMessage } from "../whatsapp/services/index.js";
import type { InboundMessageContext } from "../whatsapp/services/message-router.js";
import {
  handleBlockCommand,
  handleCancelCommand,
  handleDoneCommand,
  handleNoshowCommand,
  handleReportUpload,
  handleSlotCommand,
  handleTodayCommand,
} from "./commands/index.js";

const HELP_TEXT =
  "Available commands:\n" +
  "TODAY\n" +
  "DONE <token>\n" +
  "NOSHOW <token>\n" +
  "CANCEL <token> <reason>\n" +
  "BLOCK <doctor name> <date YYYY-MM-DD>\n" +
  "SLOT <doctor name> <days e.g. MON,WED,FRI> <start HH:MM> <end HH:MM> <duration minutes>\n" +
  'REPORT — attach a PDF with caption "REPORT <phone_number>"';

export async function handleStaffMessage(ctx: InboundMessageContext): Promise<void> {
  const reply = (body: string) =>
    sendTextMessage({
      tenantId: ctx.tenant.id,
      phoneNumberId: ctx.tenant.whatsappPhoneNumberId,
      to: ctx.phoneNumber,
      body,
    });

  if (ctx.messageType === "document") {
    await reply(await handleReportUpload(ctx));
    return;
  }

  if (ctx.body === null) {
    await reply(HELP_TEXT);
    return;
  }

  const trimmed = ctx.body.trim();
  const spaceIdx = trimmed.indexOf(" ");
  const commandWord = (spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)).toUpperCase();
  const args = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1);

  let result: string;
  switch (commandWord) {
    case "TODAY":
      result = await handleTodayCommand(ctx);
      break;
    case "DONE":
      result = await handleDoneCommand(ctx, args);
      break;
    case "NOSHOW":
      result = await handleNoshowCommand(ctx, args);
      break;
    case "CANCEL":
      result = await handleCancelCommand(ctx, args);
      break;
    case "BLOCK":
      result = await handleBlockCommand(ctx, args);
      break;
    case "SLOT":
      result = await handleSlotCommand(ctx, args);
      break;
    case "REPORT":
      result = 'Please attach the PDF as a document with caption: REPORT <phone_number>';
      break;
    default:
      result = `Unknown command "${commandWord}".\n${HELP_TEXT}`;
  }

  await reply(result);
}
