import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorHandler, notFoundHandler } from "./middlewares/index.js";
import { whatsappRouter } from "./components/whatsapp/routes.js";
import { adminRouter } from "./components/admin/index.js";
import { qrRouter } from "./components/qr/index.js";

export const app = express();

app.use(express.static("public"));

// Allow the Next.js dev server (any localhost port) to read cookies cross-origin
app.use(
  cors({
    origin: (origin, cb) => {
      // In development allow localhost, Android emulator (10.0.2.2), and LAN IP origins
      if (
        !origin ||
        process.env.NODE_ENV !== "production" ||
        /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)
      ) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
    credentials: true, // Required so the browser sends the admin_token cookie
  })
);

app.use(cookieParser());

app.use(
  express.json({
    // Keep the raw bytes around for X-Hub-Signature-256 verification
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  })
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/admin", adminRouter);
app.use("/qr", qrRouter);
app.use(whatsappRouter);

app.use(notFoundHandler);
app.use(errorHandler);
