import { Router } from "express";
import {
  handleIncomingCall,
  handleStep,
  handleHangup,
  handleFallback,
  handleHealth,
} from "../controllers/ivr.controller.js";

export const ivrRouter = Router();

// Health check — no auth needed
ivrRouter.get("/health", handleHealth);

// Exotel webhooks — all POST except fallback
ivrRouter.post("/incoming", handleIncomingCall);
ivrRouter.post("/step", handleStep);
ivrRouter.post("/hangup", handleHangup);
ivrRouter.get("/fallback", handleFallback);
