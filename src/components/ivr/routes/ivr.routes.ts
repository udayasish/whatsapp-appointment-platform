import { Router } from "express";
import {
  handleIncomingCall,
  handleStep,
  handlePrompt,
  handlePromptFallback,
  handleHangup,
  handleFallback,
  handleHealth,
} from "../controllers/ivr.controller.js";
import { exotelIpAllowlistMiddleware } from "../middlewares/ip-allowlist.middleware.js";

export const ivrRouter = Router();

// Health check — no auth needed
ivrRouter.get("/health", handleHealth);

// Explicit HEAD handlers for Exotel pre-flight gateway verification
ivrRouter.head("/prompt", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.status(200).end();
});
ivrRouter.head("/prompt/fallback", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.status(200).end();
});
ivrRouter.head("/step", (_req, res) => {
  res.setHeader("Content-Type", "text/xml");
  res.status(200).end();
});
ivrRouter.head("/incoming", (_req, res) => {
  res.setHeader("Content-Type", "text/xml");
  res.status(200).end();
});

// Exotel webhooks — support both GET and POST (Passthru uses GET; ExoML uses POST)
ivrRouter.all("/incoming", exotelIpAllowlistMiddleware, handleIncomingCall);
ivrRouter.all("/prompt", exotelIpAllowlistMiddleware, handlePrompt);
ivrRouter.all("/prompt/fallback", exotelIpAllowlistMiddleware, handlePromptFallback);
ivrRouter.all("/step", exotelIpAllowlistMiddleware, handleStep);
ivrRouter.all("/hangup", exotelIpAllowlistMiddleware, handleHangup);
ivrRouter.all("/fallback", exotelIpAllowlistMiddleware, handleFallback);


