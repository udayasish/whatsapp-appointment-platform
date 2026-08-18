import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env, UnauthorizedError } from "../../lib/index.js";

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

/** Verifies Meta's `X-Hub-Signature-256` header against the raw request body. */
export function verifyWhatsappSignature(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const signatureHeader = req.header("X-Hub-Signature-256");
  const rawBody = (req as RequestWithRawBody).rawBody;

  if (!signatureHeader || !rawBody) {
    throw new UnauthorizedError("Missing WhatsApp webhook signature");
  }

  const expected =
    "sha256=" +
    createHmac("sha256", env.WHATSAPP_APP_SECRET).update(rawBody).digest("hex");

  const providedBuf = Buffer.from(signatureHeader);
  const expectedBuf = Buffer.from(expected);

  if (
    providedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(providedBuf, expectedBuf)
  ) {
    throw new UnauthorizedError("Invalid WhatsApp webhook signature");
  }

  next();
}
