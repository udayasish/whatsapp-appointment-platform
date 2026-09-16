import { Router } from "express";
import {
  handleIncomingCall,
  handleStep,
  handlePrompt,
  handleHangup,
  handleFallback,
  handleHealth,
} from "../controllers/ivr.controller.js";
import { exotelIpAllowlistMiddleware } from "../middlewares/ip-allowlist.middleware.js";

export const ivrRouter = Router();

// Health check — no auth needed
ivrRouter.get("/health", handleHealth);

// Exotel webhooks — support both GET and POST (Passthru uses GET; ExoML uses POST)
ivrRouter.all("/incoming", exotelIpAllowlistMiddleware, handleIncomingCall);
ivrRouter.all("/prompt", exotelIpAllowlistMiddleware, handlePrompt);
ivrRouter.all("/step", exotelIpAllowlistMiddleware, handleStep);
ivrRouter.all("/hangup", exotelIpAllowlistMiddleware, handleHangup);
ivrRouter.all("/fallback", exotelIpAllowlistMiddleware, handleFallback);

