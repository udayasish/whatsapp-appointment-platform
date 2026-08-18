import type { NextFunction, Request, Response } from "express";

export function requireAdminSession(req: Request, res: Response, next: NextFunction) {
  if (!req.session.isAdmin) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}
