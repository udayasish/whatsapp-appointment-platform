import type { Request, Response } from "express";
import {
  handleIncomingCallFlow,
  handleDtmfStepFlow,
  handleHangupFlow,
  getFallbackXml,
  getHealthStatus,
} from "../services/ivr-flow.service.js";
import { buildHangup } from "../services/xml.service.js";
import {
  incomingCallSchema,
  dtmfStepSchema,
  hangupSchema,
} from "../schemas/ivr.schema.js";
import { logger } from "../../../lib/index.js";

export async function handleIncomingCall(
  req: Request,
  res: Response
): Promise<void> {
  res.set("Content-Type", "text/xml");
  try {
    const parsed = incomingCallSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn("IVR incoming call invalid payload", {
        issues: parsed.error.issues,
      });
      res.send(
        buildHangup(
          "We are currently unavailable. Please call back later. Goodbye."
        )
      );
      return;
    }

    const { CallSid, From, To } = parsed.data;
    const responseXml = await handleIncomingCallFlow(CallSid, From, To);
    res.send(responseXml);
  } catch (err) {
    logger.error("IVR error in handleIncomingCall", { err });
    res.send(
      buildHangup(
        "Sorry, something went wrong. Please call back later. Goodbye."
      )
    );
  }
}

export async function handleStep(req: Request, res: Response): Promise<void> {
  res.set("Content-Type", "text/xml");
  try {
    const parsed = dtmfStepSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn("IVR dtmfStep invalid payload", {
        issues: parsed.error.issues,
      });
      res.send(
        buildHangup(
          "We are currently unavailable. Please call back later. Goodbye."
        )
      );
      return;
    }

    const { CallSid, Digits } = parsed.data;
    const responseXml = await handleDtmfStepFlow(CallSid, Digits.trim());
    res.send(responseXml);
  } catch (err) {
    logger.error("IVR error in handleStep", { err });
    res.send(
      buildHangup("Sorry, something went wrong. Please call back. Goodbye.")
    );
  }
}

export async function handleHangup(req: Request, res: Response): Promise<void> {
  try {
    const parsed = hangupSchema.safeParse(req.body);
    const callSid = parsed.success
      ? parsed.data.CallSid
      : (req.body?.CallSid as string | undefined);
    await handleHangupFlow(callSid);
  } catch (err) {
    logger.warn("IVR error in handleHangup", { err });
  }
  res.sendStatus(200);
}

export function handleFallback(_req: Request, res: Response): void {
  res.set("Content-Type", "text/xml");
  res.send(getFallbackXml());
}

export function handleHealth(_req: Request, res: Response): void {
  res.json(getHealthStatus());
}
