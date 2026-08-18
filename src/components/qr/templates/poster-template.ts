import type { ClinicQrInfo } from "../types.js";

export function renderStandeePosterHtml(info: ClinicQrInfo): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Book Appointment — ${escapeHtml(info.clinicName)}</title>
  <style>
    :root {
      --primary: #0f766e;
      --primary-dark: #115e59;
      --wa-green: #25D366;
      --wa-dark: #128C7E;
      --ink: #0f172a;
      --muted: #475569;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --border: #e2e8f0;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--ink);
      line-height: 1.4;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      padding: 24px 16px;
    }

    .no-print-bar {
      width: 100%;
      max-width: 520px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      padding: 12px 18px;
      border-radius: 12px;
      border: 1px solid var(--border);
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      border: none;
      transition: background 0.15s ease;
    }

    .btn-primary {
      background: var(--primary);
      color: white;
    }

    .btn-primary:hover {
      background: var(--primary-dark);
    }

    .btn-outline {
      background: transparent;
      color: var(--muted);
      border: 1px solid var(--border);
    }

    .btn-outline:hover {
      background: #f1f5f9;
      color: var(--ink);
    }

    /* Standee / Poster Container */
    .standee-card {
      width: 100%;
      max-width: 480px;
      background: var(--card-bg);
      border: 2px solid #0d9488;
      border-radius: 24px;
      padding: 36px 28px 28px;
      text-align: center;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
      position: relative;
    }

    .clinic-badge {
      display: inline-block;
      background: #ccfbf1;
      color: #0f766e;
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 6px 14px;
      border-radius: 999px;
      margin-bottom: 12px;
    }

    .clinic-title {
      font-size: 1.65rem;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
      margin-bottom: 6px;
    }

    .headline {
      font-size: 1.15rem;
      font-weight: 600;
      color: #0f766e;
      margin-bottom: 24px;
    }

    .qr-frame {
      display: inline-block;
      background: #ffffff;
      padding: 16px;
      border-radius: 20px;
      border: 2px dashed #99f6e4;
      box-shadow: 0 4px 12px rgba(15, 118, 110, 0.08);
      margin-bottom: 20px;
    }

    .qr-img {
      width: 240px;
      height: 240px;
      display: block;
      margin: 0 auto;
    }

    .wa-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: #25D366;
      color: #ffffff;
      font-size: 0.95rem;
      font-weight: 700;
      padding: 8px 18px;
      border-radius: 999px;
      margin-bottom: 22px;
      text-decoration: none;
      box-shadow: 0 2px 6px rgba(37, 211, 102, 0.3);
    }

    .wa-icon {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }

    .steps-container {
      background: #f0fdfa;
      border: 1px solid #ccfbf1;
      border-radius: 16px;
      padding: 16px;
      text-align: left;
      margin-bottom: 20px;
    }

    .step-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 10px;
    }

    .step-item:last-child {
      margin-bottom: 0;
    }

    .step-num {
      flex-shrink: 0;
      width: 22px;
      height: 22px;
      background: #0f766e;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      margin-top: 1px;
    }

    .step-text {
      font-size: 0.88rem;
      color: #1e293b;
      line-height: 1.35;
    }

    .step-text strong {
      color: #0f172a;
    }

    .footer-note {
      font-size: 0.8rem;
      color: var(--muted);
    }

    .footer-phone {
      font-weight: 700;
      color: #0f172a;
      letter-spacing: 0.03em;
    }

    /* Print Specific Styling */
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
        display: block !important;
      }

      .no-print-bar {
        display: none !important;
      }

      .standee-card {
        max-width: 100% !important;
        border: 2px solid #0f766e !important;
        box-shadow: none !important;
        border-radius: 16px !important;
        padding: 30px 24px !important;
        page-break-inside: avoid;
        margin: 0 auto !important;
      }

      .qr-frame {
        box-shadow: none !important;
        border: 2px dashed #0f766e !important;
      }

      .wa-pill {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .steps-container {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .step-num {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>

  <div class="no-print-bar">
    <a href="/admin" class="btn btn-outline">&larr; Back to Admin</a>
    <button onclick="window.print()" class="btn btn-primary">
      🖨️ Print Standee / Poster
    </button>
  </div>

  <div class="standee-card">
    <div class="clinic-badge">WhatsApp Appointment Booking</div>
    <h1 class="clinic-title">${escapeHtml(info.clinicName)}</h1>
    <p class="headline">Instant Doctor Appointments</p>

    <div class="qr-frame">
      <img src="${info.qrDataUrl}" alt="QR code to book appointment on WhatsApp" class="qr-img" />
    </div>

    <div>
      <a href="${info.waMeUrl}" class="wa-pill" target="_blank" rel="noopener noreferrer">
        <svg class="wa-icon" viewBox="0 0 24 24">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67Z"/>
        </svg>
        <span>Chat on WhatsApp</span>
      </a>
    </div>

    <div class="steps-container">
      <div class="step-item">
        <div class="step-num">1</div>
        <div class="step-text"><strong>Scan the QR code</strong> with your phone camera</div>
      </div>
      <div class="step-item">
        <div class="step-num">2</div>
        <div class="step-text"><strong>Tap Send</strong> (<span style="color:#25D366; font-weight:bold;">&#10148;</span> green button) with pre-filled "Hi"</div>
      </div>
      <div class="step-item">
        <div class="step-num">3</div>
        <div class="step-text"><strong>Choose doctor &amp; time</strong> &mdash; confirmed in 1 minute!</div>
      </div>
    </div>

    <p class="footer-note">
      WhatsApp: <span class="footer-phone">${escapeHtml(info.displayNumber)}</span>
    </p>
  </div>

</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
