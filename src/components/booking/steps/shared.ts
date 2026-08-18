import { formatDateLong, formatTime12h } from "../../../common/format.js";
import { listActiveDoctors } from "../../doctors/services/index.js";
import { listAvailableDates, listAvailableSlots } from "../../slots/services/index.js";
import { t } from "../messages.js";
import type { BookingTempData, Lang } from "../types.js";

// WhatsApp List Messages cap out at 10 rows total — rather than paginate,
// the business constraint is 10-day booking horizons and doctors never
// realistically having more than a handful of daily slots, so this cap
// should never actually bite; it's just insurance against a send failing.
const MAX_LIST_ROWS = 10;

interface ListRow {
  id: string;
  title: string;
  description?: string;
}

export interface DoctorListPrompt {
  reply: string;
  buttonLabel: string;
  rows: ListRow[];
  doctorIds: string[];
  doctorNames: string[];
  doctorSpecializations: (string | undefined)[];
}

/** Returns null when the tenant has no active doctors to offer. */
export async function buildDoctorListPrompt(
  tenantId: string,
  lang: Lang
): Promise<DoctorListPrompt | null> {
  const doctorList = (await listActiveDoctors(tenantId)).slice(0, MAX_LIST_ROWS);
  if (doctorList.length === 0) return null;

  return {
    reply: t(lang, "doctorListHeader"),
    buttonLabel: t(lang, "chooseDoctorButtonLabel"),
    rows: doctorList.map((d, i) => ({
      id: String(i + 1),
      title: `Dr. ${d.name}`.slice(0, 24),
      description: d.specialization?.slice(0, 72),
    })),
    doctorIds: doctorList.map((d) => d.id),
    doctorNames: doctorList.map((d) => d.name),
    doctorSpecializations: doctorList.map((d) => d.specialization ?? undefined),
  };
}

export interface DateListPrompt {
  reply: string;
  buttonLabel: string;
  rows: ListRow[];
  dates: string[];
}

/** Returns null when the doctor has no upcoming available dates. */
export async function buildDateListPrompt(
  doctorId: string,
  lang: Lang
): Promise<DateListPrompt | null> {
  const dates = (await listAvailableDates(doctorId)).slice(0, MAX_LIST_ROWS);
  if (dates.length === 0) return null;

  return {
    reply: t(lang, "dateListHeader"),
    buttonLabel: t(lang, "chooseDateButtonLabel"),
    rows: dates.map((d, i) => ({ id: String(i + 1), title: formatDateLong(d) })),
    dates,
  };
}

export interface SlotListPrompt {
  reply: string;
  buttonLabel: string;
  rows: ListRow[];
  slotIds: string[];
  slotStartTimes: string[];
}

/** Returns null when the chosen date has no available slots left. */
export async function buildSlotListPrompt(
  doctorId: string,
  date: string,
  lang: Lang
): Promise<SlotListPrompt | null> {
  const slotList = (await listAvailableSlots(doctorId, date)).slice(0, MAX_LIST_ROWS);
  if (slotList.length === 0) return null;

  return {
    reply: t(lang, "slotListHeader"),
    buttonLabel: t(lang, "chooseTimeButtonLabel"),
    rows: slotList.map((s, i) => ({ id: String(i + 1), title: formatTime12h(s.startTime) })),
    slotIds: slotList.map((s) => s.id),
    slotStartTimes: slotList.map((s) => s.startTime),
  };
}

// Rebuilds list rows from already-cached tempData arrays (no DB call) — used
// on invalid-input retries, where we're re-showing the same options rather
// than fetching a fresh set.

export function doctorRowsFromTempData(tempData: BookingTempData): ListRow[] {
  const names = tempData.doctorNames ?? [];
  const specs = tempData.doctorSpecializations ?? [];
  return names.map((name, i) => ({
    id: String(i + 1),
    title: `Dr. ${name}`.slice(0, 24),
    description: specs[i]?.slice(0, 72),
  }));
}

export function dateRowsFromTempData(tempData: BookingTempData): ListRow[] {
  return (tempData.dates ?? []).map((d, i) => ({ id: String(i + 1), title: formatDateLong(d) }));
}

export function slotRowsFromTempData(tempData: BookingTempData): ListRow[] {
  return (tempData.slotStartTimes ?? []).map((time, i) => ({
    id: String(i + 1),
    title: formatTime12h(time),
  }));
}

export function buildConfirmSummary(lang: Lang, tempData: BookingTempData): string {
  return (
    t(lang, "confirmHeader") +
    `\n\n👨‍⚕️ Doctor: *${tempData.doctorName}*` +
    `\n📅 Date: *${formatDateLong(tempData.date!)}*` +
    `\n⏰ Time: *${formatTime12h(tempData.slotStartTime!)}*` +
    `\n🧑 Patient: *${tempData.patientName}* (Age ${tempData.patientAge})` +
    `\n📝 Reason: ${tempData.complaint}`
  );
}

export function invalidReply(lang: Lang, tempData: BookingTempData): string {
  return `${t(lang, "invalidGeneric")}\n\n${tempData.lastPrompt ?? ""}`;
}

interface ReplyButton {
  id: string;
  title: string;
}

/** English/Assamese labels themselves — shown before a language is chosen, so not run through t(). */
export function languageButtons(): ReplyButton[] {
  return [
    { id: "1", title: "English" },
    { id: "2", title: "Assamese (অসমীয়া)" },
  ];
}

export function actionButtons(lang: Lang): ReplyButton[] {
  return [
    { id: "1", title: t(lang, "bookButtonLabel") },
    { id: "2", title: t(lang, "viewButtonLabel") },
  ];
}

export function confirmButtons(lang: Lang): ReplyButton[] {
  return [
    { id: "yes", title: t(lang, "confirmButtonLabel") },
    { id: "cancel", title: t(lang, "cancelButtonLabel") },
  ];
}
