import axios from "axios";
import { env, logger } from "../../../lib/index.js";

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Sends booking confirmation SMS via Exotel SMS API.
 * Endpoint: POST https://api.exotel.com/v1/Accounts/{ACCOUNT_SID}/Sms/send.json
 * Auth: HTTP Basic (API_KEY:API_TOKEN)
 *
 * IMPORTANT: On any error, logs but never throws so an SMS failure never
 * breaks or rolls back a confirmed booking.
 */
export async function sendBookingConfirmationSms(
  patientPhone: string,
  doctorName: string,
  appointmentDate: string,
  appointmentTime: string,
  tokenNumber: number
): Promise<void> {
  const accountSid = env.EXOTEL_ACCOUNT_SID;
  const apiKey = env.EXOTEL_API_KEY;
  const apiToken = env.EXOTEL_API_TOKEN;
  const fromNumber = env.IVR_PHONE_NUMBER;

  if (!accountSid || !apiKey || !apiToken) {
    logger.warn("Exotel credentials not configured, skipping confirmation SMS", {
      patientPhone,
      tokenNumber,
    });
    return;
  }

  const formattedDate = formatDate(appointmentDate);
  const formattedTime = formatTime(appointmentTime);
  const messageBody = `Appointment confirmed! Token #${tokenNumber} with ${doctorName} on ${formattedDate} at ${formattedTime}. To cancel, please call the clinic.`;

  try {
    const url = `https://api.exotel.com/v1/Accounts/${accountSid}/Sms/send.json`;
    const params = new URLSearchParams();
    if (fromNumber) {
      params.append("From", fromNumber);
    }
    params.append("To", patientPhone);
    params.append("Body", messageBody);

    const authHeader = Buffer.from(`${apiKey}:${apiToken}`).toString("base64");

    const response = await axios.post(url, params.toString(), {
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: 10_000,
    });

    logger.info("Exotel confirmation SMS sent successfully", {
      status: response.status,
      patientPhone,
      tokenNumber,
    });
  } catch (err: unknown) {
    const detail = axios.isAxiosError(err)
      ? JSON.stringify(err.response?.data)
      : String(err);
    logger.error("Failed to send Exotel confirmation SMS", {
      detail,
      patientPhone,
      tokenNumber,
    });
  }
}
