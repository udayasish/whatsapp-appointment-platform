import type { QRCodeErrorCorrectionLevel } from "qrcode";

export interface QrRenderOptions {
  errorCorrectionLevel?: QRCodeErrorCorrectionLevel;
  margin?: number;
  width?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

export interface ClinicQrInfo {
  tenantId: string;
  clinicName: string;
  displayNumber: string;
  cleanPhone: string;
  waMeUrl: string;
  qrDataUrl: string;
}
