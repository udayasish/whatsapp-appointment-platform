// Uses existing bullConnection — NO new Redis client
import { bullConnection } from "../../../lib/bull/index.js";

const SESSION_PREFIX = "ivr:session:";
const DATA_PREFIX = "ivr:data:";
const PROMPT_PREFIX = "ivr:prompt:";
export const IVR_TTL = 600; // 10 minutes

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

export interface IvrPrefetchedData {
  tenant: { id: string; name: string; status: string };
  doctors: { id: string; name: string; specialization: string | null }[];
  doctorDates?: Record<string, string[]>;
  doctorDateSlots?: Record<string, { id: string; startTime: string; endTime: string }[]>;
}

export async function createSession(callSid: string, data: IvrSession): Promise<void> {
  await bullConnection.setex(`${SESSION_PREFIX}${callSid}`, IVR_TTL, JSON.stringify(data));
}

export async function getSession(callSid: string): Promise<IvrSession | null> {
  const raw = await bullConnection.get(`${SESSION_PREFIX}${callSid}`);
  if (!raw) return null;
  return JSON.parse(raw) as IvrSession;
}

export async function updateSession(callSid: string, updates: Partial<IvrSession>): Promise<void> {
  const existing = await getSession(callSid);
  if (!existing) return;
  await bullConnection.setex(
    `${SESSION_PREFIX}${callSid}`,
    IVR_TTL,
    JSON.stringify({ ...existing, ...updates })
  );
}

export async function deleteSession(callSid: string): Promise<void> {
  await bullConnection.del(`${SESSION_PREFIX}${callSid}`);
}

/**
 * Saves a pre-computed prompt text to Redis for sub-50ms retrieval by /api/ivr/prompt
 */
export async function savePrecomputedPrompt(
  callSid: string,
  step: string,
  promptText: string
): Promise<void> {
  await bullConnection.setex(`${PROMPT_PREFIX}${callSid}:${step}`, IVR_TTL, promptText);
}

/**
 * Retrieves a pre-computed prompt text from Redis (latency < 2ms)
 */
export async function getPrecomputedPrompt(
  callSid: string,
  step: string
): Promise<string | null> {
  return bullConnection.get(`${PROMPT_PREFIX}${callSid}:${step}`);
}

/**
 * Saves pre-fetched clinic dataset for the call
 */
export async function savePrefetchedData(
  callSid: string,
  data: IvrPrefetchedData
): Promise<void> {
  await bullConnection.setex(`${DATA_PREFIX}${callSid}`, IVR_TTL, JSON.stringify(data));
}

/**
 * Retrieves pre-fetched clinic dataset
 */
export async function getPrefetchedData(
  callSid: string
): Promise<IvrPrefetchedData | null> {
  const raw = await bullConnection.get(`${DATA_PREFIX}${callSid}`);
  if (!raw) return null;
  return JSON.parse(raw) as IvrPrefetchedData;
}

/**
 * Executes an atomic Redis pipeline to store session, prefetched data,
 * and initial prompt strings in a single network roundtrip.
 */
export async function saveIvrCallDataPipeline(
  callSid: string,
  session: IvrSession,
  prefetchedData: IvrPrefetchedData,
  initialPrompts: Record<string, string>
): Promise<void> {
  const pipeline = bullConnection.pipeline();

  pipeline.setex(`${SESSION_PREFIX}${callSid}`, IVR_TTL, JSON.stringify(session));
  pipeline.setex(`${DATA_PREFIX}${callSid}`, IVR_TTL, JSON.stringify(prefetchedData));

  for (const [step, promptText] of Object.entries(initialPrompts)) {
    pipeline.setex(`${PROMPT_PREFIX}${callSid}:${step}`, IVR_TTL, promptText);
  }

  await pipeline.exec();
}

/**
 * Cleans up all Redis keys associated with a CallSid upon hangup
 */
export async function cleanupAllCallKeys(callSid: string): Promise<void> {
  const pipeline = bullConnection.pipeline();
  pipeline.del(`${SESSION_PREFIX}${callSid}`);
  pipeline.del(`${DATA_PREFIX}${callSid}`);
  pipeline.del(`${PROMPT_PREFIX}${callSid}:welcome`);
  pipeline.del(`${PROMPT_PREFIX}${callSid}:select_doctor`);
  pipeline.del(`${PROMPT_PREFIX}${callSid}:select_date`);
  pipeline.del(`${PROMPT_PREFIX}${callSid}:select_slot`);
  pipeline.del(`${PROMPT_PREFIX}${callSid}:confirm`);
  await pipeline.exec();
}

