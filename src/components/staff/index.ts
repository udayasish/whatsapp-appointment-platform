import { registerStaffMessageHandler } from "../whatsapp/services/message-router.js";
import { handleStaffMessage } from "./handle-staff-message.js";

// Self-registration (same pattern as the booking bot): importing this module
// for its side effect wires the staff command parser into the WhatsApp
// message router. See src/index.ts.
registerStaffMessageHandler(handleStaffMessage);
