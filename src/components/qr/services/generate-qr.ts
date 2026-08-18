import QRCode from "qrcode";
import type { QrRenderOptions } from "../types.js";

const DEFAULT_OPTIONS: QrRenderOptions = {
  errorCorrectionLevel: "M",
  margin: 2,
  width: 512,
  color: {
    dark: "#000000",
    light: "#ffffff",
  },
};

/**
 * Generates a Base64 Data URL string suitable for embedding directly in HTML <img> tags.
 */
export async function generateQrDataUrl(
  text: string,
  options?: QrRenderOptions
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  return QRCode.toDataURL(text, opts);
}

/**
 * Generates a PNG Buffer suitable for downloading or streaming over HTTP.
 */
export async function generateQrPngBuffer(
  text: string,
  options?: QrRenderOptions
): Promise<Buffer> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  return QRCode.toBuffer(text, { ...opts, type: "png" });
}

/**
 * Generates an SVG string suitable for scalable vector graphics in print or web.
 */
export async function generateQrSvg(
  text: string,
  options?: QrRenderOptions
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  return QRCode.toString(text, { ...opts, type: "svg" });
}
