import type { Request, Response } from "express";
import {
  handleIncomingCallFlow,
  handleDtmfStepFlow,
  handleHangupFlow,
  getPrecomputedPromptText,
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

function extractIncomingPayload(req: Request) {
  const merged = { ...req.query, ...req.body } as Record<string, unknown>;
  return {
    CallSid: String(
      merged.CallSid || merged.callSid || merged.call_sid || "",
    ).trim(),
    From: String(
      merged.From || merged.CallFrom || merged.caller || merged.from || "",
    ).trim(),
    To: String(merged.To || merged.CallTo || merged.to || "").trim(),
    CallStatus: merged.CallStatus ? String(merged.CallStatus) : undefined,
    Direction: merged.Direction ? String(merged.Direction) : undefined,
  };
}

function extractStepPayload(req: Request) {
  const merged = { ...req.query, ...req.body } as Record<string, unknown>;
  const rawDigits = String(merged.Digits ?? merged.digits ?? "");
  return {
    CallSid: String(
      merged.CallSid || merged.callSid || merged.call_sid || "",
    ).trim(),
    From:
      merged.From || merged.CallFrom
        ? String(merged.From || merged.CallFrom).trim()
        : undefined,
    To:
      merged.To || merged.CallTo
        ? String(merged.To || merged.CallTo).trim()
        : undefined,
    Digits: rawDigits.replace(/"/g, "").trim(),
  };
}

function extractHangupPayload(req: Request) {
  const merged = { ...req.query, ...req.body } as Record<string, unknown>;
  return {
    CallSid: String(
      merged.CallSid || merged.callSid || merged.call_sid || "",
    ).trim(),
    From:
      merged.From || merged.CallFrom
        ? String(merged.From || merged.CallFrom).trim()
        : undefined,
    CallStatus: merged.CallStatus ? String(merged.CallStatus) : undefined,
  };
}

export async function handleIncomingCall(
  req: Request,
  res: Response,
): Promise<void> {
  res.set("Content-Type", "text/xml");
  try {
    const rawPayload = extractIncomingPayload(req);
    logger.info("IVR handleIncomingCall received", {
      method: req.method,
      query: req.query,
      body: req.body,
      normalized: rawPayload,
    });

    const parsed = incomingCallSchema.safeParse(rawPayload);
    if (!parsed.success) {
      logger.warn("IVR incoming call invalid payload", {
        issues: parsed.error.issues,
        rawPayload,
      });
      res.send(
        buildHangup(
          "We are currently unavailable. Please call back later. Goodbye.",
        ),
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
        "Sorry, something went wrong. Please call back later. Goodbye.",
      ),
    );
  }
}

export async function handleStep(req: Request, res: Response): Promise<void> {
  res.set("Content-Type", "text/xml");
  try {
    const rawPayload = extractStepPayload(req);
    logger.info("IVR handleStep received", {
      method: req.method,
      query: req.query,
      body: req.body,
      normalized: rawPayload,
    });

    const parsed = dtmfStepSchema.safeParse(rawPayload);
    if (!parsed.success) {
      logger.warn("IVR dtmfStep invalid payload", {
        issues: parsed.error.issues,
        rawPayload,
      });
      res.send(
        buildHangup(
          "We are currently unavailable. Please call back later. Goodbye.",
        ),
      );
      return;
    }

    const { CallSid, Digits, From, To } = parsed.data;
    const cleanDigits = Digits.trim();

    // If caller pressed 0 to exit, send 302 so Passthru takes the Hangup branch
    if (cleanDigits === "0") {
      logger.info(
        "IVR caller pressed 0 to exit, sending 302 to Passthru to route to Hangup",
        {
          callSid: CallSid,
        },
      );
      await handleHangupFlow(CallSid);
      res.status(302).send("<Response><Hangup/></Response>");
      return;
    }

    const responseXml = await handleDtmfStepFlow(
      CallSid,
      cleanDigits,
      From,
      To,
    );
    logger.info("IVR step response prepared", {
      callSid: CallSid,
      statusCode: 200,
    });
    res.setHeader("Content-Type", "text/xml");
    res.status(200).send(responseXml);
  } catch (err) {
    logger.error("IVR error in handleStep", { err });
    res.setHeader("Content-Type", "text/xml");
    res
      .status(200)
      .send(
        buildHangup("Sorry, something went wrong. Please call back. Goodbye."),
      );
  }
}

export async function handlePrompt(req: Request, res: Response): Promise<void> {
  try {
    const rawPayload = extractIncomingPayload(req);
    logger.info("IVR handlePrompt received", {
      method: req.method,
      query: req.query,
      body: req.body,
      normalized: rawPayload,
    });

    const promptText = await getPrecomputedPromptText(
      rawPayload.CallSid,
      rawPayload.From,
      rawPayload.To,
    );

    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const audioUrl = `${protocol}://${host}/audio/welcome.mp3`;

    logger.info("IVR handlePrompt sending dynamic audio_url JSON to Exotel Gather", {
      callSid: rawPayload.CallSid,
      audioUrl,
      fallbackText: promptText,
    });

    const payload = JSON.stringify({
      gather_prompt: {
        audio_url: audioUrl,
      },
      max_input_digits: 1,
      finish_on_key: "#",
      input_timeout: 10,
    });

    res.setHeader("Content-Type", "application/json");
    logger.info("[IVR DEBUG PAYLOAD TO EXOTEL]", {
      callSid: rawPayload.CallSid,
      exactPayload: payload,
      byteLength: Buffer.byteLength(payload, "utf8"),
      responseContentType: res.getHeader("Content-Type"),
    });
    res.status(200).end(payload);
  } catch (err) {
    logger.error("IVR error in handlePrompt", { err });
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const audioUrl = `${protocol}://${host}/audio/welcome.mp3`;
    const fallbackPayload = JSON.stringify({
      gather_prompt: {
        audio_url: audioUrl,
      },
      max_input_digits: 1,
      finish_on_key: "#",
      input_timeout: 10,
    });
    res.setHeader("Content-Type", "application/json");
    logger.info("[IVR DEBUG FALLBACK PAYLOAD TO EXOTEL]", {
      fallbackPayload,
      responseContentType: res.getHeader("Content-Type"),
    });
    res.status(200).end(fallbackPayload);
  }
}

export function handlePromptFallback(req: Request, res: Response): void {
  logger.warn("IVR handlePromptFallback called by Exotel", {
    query: req.query,
    headers: req.headers,
  });
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const audioUrl = `${protocol}://${host}/audio/welcome.mp3`;
  const fallbackPayload = JSON.stringify({
    gather_prompt: {
      audio_url: audioUrl,
    },
    max_input_digits: 1,
    finish_on_key: "#",
    input_timeout: 10,
  });
  res.setHeader("Content-Type", "application/json");
  logger.info("[IVR DEBUG SECONDARY FALLBACK PAYLOAD TO EXOTEL]", {
    fallbackPayload,
    responseContentType: res.getHeader("Content-Type"),
  });
  res.status(200).end(fallbackPayload);
}

export async function handleHangup(req: Request, res: Response): Promise<void> {
  try {
    const rawPayload = extractHangupPayload(req);
    const parsed = hangupSchema.safeParse(rawPayload);
    const callSid = parsed.success ? parsed.data.CallSid : rawPayload.CallSid;
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
