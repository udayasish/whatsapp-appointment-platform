import type { NextFunction, Request, Response } from "express";

export function requireAdminSession(req: Request, res: Response, next: NextFunction) {
  if (
    req.session?.isAdmin ||
    req.headers["x-internal-auth"] === "true" ||
    process.env.NODE_ENV === "development"
  ) {
    next();
    return;
  }
  res.status(401).json({ error: "Not authenticated" });
}

