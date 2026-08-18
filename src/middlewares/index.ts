import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError, logger } from "../lib/index.js";

export function notFoundHandler(req: Request, res: Response) {
  res
    .status(404)
    .json({ error: `Route not found: ${req.method} ${req.path}` });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      issues: err.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
    return;
  }

  // Safety net: Postgres unique-constraint violations surface as 409s even if
  // a pre-check was raced.
  if (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "23505"
  ) {
    res.status(409).json({ error: "Duplicate value violates a uniqueness rule" });
    return;
  }

  if (err instanceof AppError) {
    logger.warn(err.message, { statusCode: err.statusCode, path: req.path });
    res.status(err.statusCode).json({
      error: err.expose ? err.message : "Internal server error",
    });
    return;
  }

  logger.error(err instanceof Error ? err : new Error(String(err)));
  res.status(500).json({ error: "Internal server error" });
}
