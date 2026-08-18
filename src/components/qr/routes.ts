import { Router } from "express";
import { getClinicQrInfo } from "./services/get-clinic-qr.js";
import { generateQrPngBuffer, generateQrSvg } from "./services/generate-qr.js";
import { renderStandeePosterHtml } from "./templates/poster-template.js";

export const qrRouter = Router();

/**
 * GET /qr and GET /qr/
 * Default landing page: renders the default/first clinic QR poster.
 */
qrRouter.get("/", async (_req, res) => {
  const info = await getClinicQrInfo();
  if (!info) {
    res.status(404).send("No active clinics found.");
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(renderStandeePosterHtml(info));
});

/**
 * GET /qr/:tenantId
 * Public landing page showing the clinic QR code and booking deep link.
 */
qrRouter.get("/:tenantId", async (req, res) => {
  const info = await getClinicQrInfo(req.params.tenantId);
  if (!info) {
    res.status(404).send("Clinic not found");
    return;
  }
  res.send(renderStandeePosterHtml(info));
});

/**
 * GET /qr/:tenantId/poster
 * Print-ready counter standee / flyer view.
 */
qrRouter.get("/:tenantId/poster", async (req, res) => {
  const info = await getClinicQrInfo(req.params.tenantId);
  if (!info) {
    res.status(404).send("Clinic not found");
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(renderStandeePosterHtml(info));
});

/**
 * GET /qr/:tenantId/image
 * Streams direct PNG or SVG QR code image for embedding or sharing.
 * Query params:
 *  - format: 'png' | 'svg' (default 'png')
 *  - size: number (default 600)
 */
qrRouter.get("/:tenantId/image", async (req, res) => {
  const info = await getClinicQrInfo(req.params.tenantId);
  if (!info) {
    res.status(404).send("Clinic not found");
    return;
  }

  const format = req.query.format === "svg" ? "svg" : "png";
  const size = Math.min(Math.max(Number(req.query.size) || 600, 100), 2400);

  if (format === "svg") {
    const svg = await generateQrSvg(info.waMeUrl, { width: size });
    res.setHeader("Content-Type", "image/svg+xml");
    res.send(svg);
    return;
  }

  const pngBuffer = await generateQrPngBuffer(info.waMeUrl, { width: size });
  res.setHeader("Content-Type", "image/png");
  res.send(pngBuffer);
});

/**
 * GET /qr/:tenantId/download
 * Downloads the QR code file with attachment header.
 */
qrRouter.get("/:tenantId/download", async (req, res) => {
  const info = await getClinicQrInfo(req.params.tenantId);
  if (!info) {
    res.status(404).send("Clinic not found");
    return;
  }

  const format = req.query.format === "svg" ? "svg" : "png";
  const size = Math.min(Math.max(Number(req.query.size) || 1200, 100), 4000);
  const slug = info.clinicName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const filename = `${slug}-whatsapp-qr.${format}`;

  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  if (format === "svg") {
    const svg = await generateQrSvg(info.waMeUrl, { width: size });
    res.setHeader("Content-Type", "image/svg+xml");
    res.send(svg);
    return;
  }

  const pngBuffer = await generateQrPngBuffer(info.waMeUrl, { width: size });
  res.setHeader("Content-Type", "image/png");
  res.send(pngBuffer);
});
