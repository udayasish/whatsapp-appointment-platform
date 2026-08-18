import type { ConversationStep, Tenant, User } from "../../lib/db/index.js";

export type Lang = "en" | "as";

/** Mid-flow selections, persisted as conversation_state.temp_data (JSONB). */
export interface BookingTempData {
  lang?: Lang;
  /** Exact text of the last numbered-list prompt shown, re-sent verbatim on invalid input. */
  lastPrompt?: string;
  doctorIds?: string[];
  doctorNames?: string[];
  doctorSpecializations?: (string | undefined)[];
  dates?: string[];
  slotIds?: string[];
  slotStartTimes?: string[];
  doctorId?: string;
  doctorName?: string;
  date?: string;
  slotId?: string;
  slotStartTime?: string;
  patientName?: string;
  patientAge?: number;
  complaint?: string;
}

export interface StepContext {
  tenant: Tenant;
  patient: User;
  lang: Lang;
  tempData: BookingTempData;
  /** Trimmed inbound text. */
  body: string;
}

export interface StepResult {
  nextStep: ConversationStep;
  tempData: BookingTempData;
  reply: string;
  /** When set, `reply` is sent as tappable buttons instead of plain text. */
  buttons?: { id: string; title: string }[];
  /** When set, `reply` is sent as a tappable list instead of plain text. */
  list?: {
    buttonLabel: string;
    rows: { id: string; title: string; description?: string }[];
  };
}
