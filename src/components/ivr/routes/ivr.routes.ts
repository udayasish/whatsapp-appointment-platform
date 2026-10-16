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
import { logger } from "../../../lib/index.js";

export const ivrRouter = Router();

// Detailed IVR request/response debug inspector
ivrRouter.use((req, res, next) => {
  const start = Date.now();
  logger.info(`>>> [IVR DEBUG INCOMING] ${req.method} ${req.originalUrl}`, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    headers: req.headers,
    query: req.query,
    body: req.body,
  });

  res.on("finish", () => {
    logger.info(`<<< [IVR DEBUG OUTGOING] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`, {
      statusCode: res.statusCode,
      responseHeaders: res.getHeaders(),
    });
  });

  req.on("close", () => {
    if (!res.writableEnded) {
      logger.warn(`!!! [IVR DEBUG SOCKET CLOSED EARLY] ${req.method} ${req.originalUrl} closed by client before response ended!`);
    }
  });

  next();
});

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


