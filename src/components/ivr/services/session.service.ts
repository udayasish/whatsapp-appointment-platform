// Uses existing bullConnection — NO new Redis client
import { bullConnection } from "../../../lib/bull/index.js";

const PREFIX = "ivr:session:";
const TTL = 600; // 10 minutes

export interface IvrSession {
  step: "welcome" | "select_doctor" | "select_date" | "select_slot" | "confirm";
  tenantId: string;
  clinicName?: string;
  callerPhone: string;
  doctors?: { id: string; name: string; specialization: string | null }[];
  selectedDoctorId?: string;
  selectedDoctorName?: string;
  dates?: string[];
  selectedDate?: string;
  slots?: { id: string; startTime: string; endTime: string }[];
  selectedSlotId?: string;
  selectedSlotTime?: string;
  invalidCount?: number;
}

export async function createSession(callSid: string, data: IvrSession): Promise<void> {
  await bullConnection.setex(`${PREFIX}${callSid}`, TTL, JSON.stringify(data));
}

export async function getSession(callSid: string): Promise<IvrSession | null> {
  const raw = await bullConnection.get(`${PREFIX}${callSid}`);
  if (!raw) return null;
  return JSON.parse(raw) as IvrSession;
}

export async function updateSession(callSid: string, updates: Partial<IvrSession>): Promise<void> {
  const existing = await getSession(callSid);
  if (!existing) return;
  await bullConnection.setex(
    `${PREFIX}${callSid}`,
    TTL,
    JSON.stringify({ ...existing, ...updates })
  );
}

export async function deleteSession(callSid: string): Promise<void> {
  await bullConnection.del(`${PREFIX}${callSid}`);
}
