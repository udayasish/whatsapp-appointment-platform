import type { Tenant, User, UserRole } from "../../../lib/db/index.js";
import logger from "../../../lib/logger.js";

export interface InboundMessageContext {
  tenant: Tenant;
  role: UserRole | "unknown";
  user: User | null;
  phoneNumber: string;
  messageType: string;
  body: string | null;
  mediaId: string | null;
  raw: unknown;
}

type MessageHandler = (ctx: InboundMessageContext) => Promise<void>;

let patientMessageHandler: MessageHandler | null = null;
let staffMessageHandler: MessageHandler | null = null;

/** Self-registered by the booking bot component (Phase 3) at module load. */
export function registerPatientMessageHandler(handler: MessageHandler) {
  patientMessageHandler = handler;
}

/** Self-registered by the staff command handler component (Phase 5) at module load. */
export function registerStaffMessageHandler(handler: MessageHandler) {
  staffMessageHandler = handler;
}

/**
 * Doctors/receptionists go to the staff command parser; everyone else
 * (patients, and unknown numbers — prospective patients the booking bot
 * onboards on first contact) goes to the patient booking bot.
 */
export async function routeInboundMessage(ctx: InboundMessageContext) {
  if (ctx.role === "doctor" || ctx.role === "receptionist") {
    if (!staffMessageHandler) {
      logger.warn("No staff message handler registered yet", {
        tenantId: ctx.tenant.id,
      });
      return;
    }
    return staffMessageHandler(ctx);
  }

  if (!patientMessageHandler) {
    logger.warn("No patient message handler registered yet", {
      tenantId: ctx.tenant.id,
    });
    return;
  }
  return patientMessageHandler(ctx);
}
