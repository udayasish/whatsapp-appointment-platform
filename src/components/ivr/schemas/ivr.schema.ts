import { z } from "zod";

// Exotel sends these fields on every webhook POST
export const incomingCallSchema = z.object({
  CallSid: z.string().min(1),
  From: z.string().min(1),
  To: z.string().min(1),
  CallStatus: z.string().optional(),
  Direction: z.string().optional(),
});

export const dtmfStepSchema = z.object({
  CallSid: z.string().min(1),
  From: z.string().min(1),
  To: z.string().min(1),
  Digits: z.string().optional().default(""),
});

export const hangupSchema = z.object({
  CallSid: z.string().min(1),
  From: z.string().optional(),
  CallStatus: z.string().optional(),
});

export type IncomingCallBody = z.infer<typeof incomingCallSchema>;
export type DtmfStepBody = z.infer<typeof dtmfStepSchema>;
export type HangupBody = z.infer<typeof hangupSchema>;
