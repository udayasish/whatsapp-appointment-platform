import { getDoctorByUserId } from "../doctors/services/index.js";
import type { InboundMessageContext } from "../whatsapp/services/message-router.js";

export type DoctorScopeResult =
  | { ok: true; doctorId?: string }
  | { ok: false; message: string };

/**
 * A receptionist acts clinic-wide (no restriction); a doctor is scoped to
 * their own appointments. Used by TODAY/DONE/NOSHOW/CANCEL so a doctor can
 * never act on another doctor's queue.
 */
export async function resolveDoctorScope(ctx: InboundMessageContext): Promise<DoctorScopeResult> {
  if (ctx.role !== "doctor") return { ok: true };
  if (!ctx.user) return { ok: false, message: "Could not identify your account." };

  const doctor = await getDoctorByUserId(ctx.user.id);
  if (!doctor) return { ok: false, message: "No doctor profile found for your account." };

  return { ok: true, doctorId: doctor.id };
}
