import { registerPatientMessageHandler } from "../whatsapp/services/message-router.js";
import { handleBookingMessage } from "./handle-booking-message.js";

// Self-registration (reference-project pattern): importing this module for
// its side effect is enough to wire the patient booking bot into the
// WhatsApp message router. See src/index.ts.
registerPatientMessageHandler(handleBookingMessage);
