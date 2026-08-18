import express from "express";
import session from "express-session";
import { errorHandler, notFoundHandler } from "./middlewares/index.js";
import { whatsappRouter } from "./components/whatsapp/routes.js";
import { adminRouter, sessionStore } from "./components/admin/index.js";
import { qrRouter } from "./components/qr/index.js";
import { env } from "./lib/env.js";

export const app = express();

app.use(express.static("public"));

app.use(
  express.json({
    // Keep the raw bytes around for X-Hub-Signature-256 verification —
    // re-stringifying the parsed body could produce a different byte sequence.
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  })
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(
  "/api/admin",
  session({
    store: sessionStore,
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: "admin.sid",
    cookie: {
      httpOnly: true,
      sameSite: "strict",
      secure: env.NODE_ENV === "production",
      maxAge: 12 * 60 * 60 * 1000,
    },
  }),
  adminRouter
);

app.use("/qr", qrRouter);
app.use(whatsappRouter);

app.use(notFoundHandler);
app.use(errorHandler);
