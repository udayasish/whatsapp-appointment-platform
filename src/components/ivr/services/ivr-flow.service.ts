import { buildGather, buildHangup } from "./xml.service.js";
import {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  type IvrSession,
} from "./session.service.js";
import { resolveTenantByIvrPhone } from "./resolve-tenant.service.js";
import { listActiveDoctors } from "../../doctors/services/list-active-doctors.js";
import { listAvailableDates } from "../../slots/services/list-available-dates.js";
import { listAvailableSlots } from "../../slots/services/list-available-slots.js";
import { executeIvrBooking } from "./booking.service.js";
import {
  buildWelcomePrompt,
  buildDoctorMenuPrompt,
  buildDateMenuPrompt,
  buildSlotMenuPrompt,
  buildConfirmPrompt,
  buildConfirmedPrompt,
} from "./prompts.service.js";
import { env, logger } from "../../../lib/index.js";

function getStepUrl(): string {
  return `${env.APP_BASE_URL}/api/ivr/step`;
}

async function handleInvalid(
  callSid: string,
  session: IvrSession,
  replayPrompt: string,
  emptyInput = false
): Promise<string> {
  const stepUrl = getStepUrl();
  const count = (session.invalidCount ?? 0) + 1;
  if (count >= 3) {
    await deleteSession(callSid);
    logger.info("IVR max invalid attempts reached, ending call", {
      callSid,
      tenantId: session.tenantId,
      step: session.step,
      attempts: count,
    });
    return buildHangup("Too many invalid attempts. Please call back. Goodbye.");
  }
  await updateSession(callSid, { invalidCount: count });
  const prefix = emptyInput
    ? "We did not receive your input. Please try again."
    : "Sorry, that was not a valid option. Please try again.";
  return buildGather(`${prefix} ${replayPrompt}`, stepUrl);
}

/**
 * Handles incoming call flow:
 * Resolves tenant, ensures active doctors exist, initializes session,
 * and returns the welcome ExoML response.
 */
export async function handleIncomingCallFlow(
  callSid: string,
  from: string,
  to: string
): Promise<string> {
  const tenant = await resolveTenantByIvrPhone(to);

  if (!tenant || tenant.status !== "active") {
    logger.warn("IVR call for unknown or inactive tenant", {
      to,
      callSid,
      status: tenant?.status,
    });
    return buildHangup(
      "Sorry, clinic not found or inactive. Please call back later. Goodbye."
    );
  }

  const doctors = await listActiveDoctors(tenant.id);
  if (doctors.length === 0) {
    logger.warn("IVR call with no active doctors", {
      tenantId: tenant.id,
      callSid,
    });
    return buildHangup(
      "Sorry, no doctors are available right now. Please call back later. Goodbye."
    );
  }

  await createSession(callSid, {
    step: "welcome",
    tenantId: tenant.id,
    clinicName: tenant.name,
    callerPhone: from,
    doctors,
    invalidCount: 0,
  });

  logger.info("IVR incoming call initialized", {
    callSid,
    tenantId: tenant.id,
    clinicName: tenant.name,
    callerPhone: from,
    availableDoctorsCount: doctors.length,
  });

  const stepUrl = getStepUrl();
  const welcomePrompt = buildWelcomePrompt(tenant.name);
  return buildGather(welcomePrompt, stepUrl);
}

/**
 * Handles DTMF input step flow across the state machine:
 * welcome -> select_doctor -> select_date -> select_slot -> confirm
 */
export async function handleDtmfStepFlow(
  callSid: string,
  rawDigit: string,
  from?: string,
  to?: string
): Promise<string> {
  const stepUrl = getStepUrl();
  const digit = (rawDigit || "").trim();
  const isBlank = digit.length === 0;
  let session = await getSession(callSid);

  if (!session && to) {
    logger.info("IVR session missing on step, auto-initializing from call metadata", {
      callSid,
      from,
      to,
    });
    const tenant = await resolveTenantByIvrPhone(to);
    if (tenant && tenant.status === "active") {
      const doctors = await listActiveDoctors(tenant.id);
      if (doctors.length > 0) {
        session = {
          step: "welcome",
          tenantId: tenant.id,
          clinicName: tenant.name,
          callerPhone: from || "",
          doctors,
          invalidCount: 0,
        };
        await createSession(callSid, session);
        logger.info("IVR session auto-initialized successfully", {
          callSid,
          tenantId: tenant.id,
          clinicName: tenant.name,
        });
      }
    }
  }

  if (!session) {
    logger.warn("IVR session not found or expired", { callSid });
    return buildHangup("Your session has expired. Please call back. Goodbye.");
  }

  logger.info("IVR step processing", {
    callSid,
    tenantId: session.tenantId,
    step: session.step,
    digit: digit || "<empty>",
    invalidCount: session.invalidCount ?? 0,
  });

  switch (session.step) {
    case "welcome": {
      if (digit === "1") {
        let doctors = session.doctors;
        if (!doctors || doctors.length === 0) {
          doctors = await listActiveDoctors(session.tenantId);
        }
        if (doctors.length === 0) {
          logger.warn("IVR no doctors available on welcome transition", {
            callSid,
            tenantId: session.tenantId,
          });
          return buildHangup(
            "Sorry, no doctors are available right now. Please call back later. Goodbye."
          );
        }
        await updateSession(callSid, {
          step: "select_doctor",
          doctors,
          invalidCount: 0,
        });
        return buildGather(buildDoctorMenuPrompt(doctors), stepUrl);
      } else if (digit === "0") {
        await deleteSession(callSid);
        logger.info("IVR caller selected exit from welcome", {
          callSid,
          tenantId: session.tenantId,
        });
        return buildHangup("Thank you for calling. Goodbye.");
      } else {
        const welcomePrompt = buildWelcomePrompt(session.clinicName);
        return handleInvalid(callSid, session, welcomePrompt, isBlank);
      }
    }

    case "select_doctor": {
      if (digit === "*") {
        await updateSession(callSid, { step: "welcome", invalidCount: 0 });
        const welcomePrompt = buildWelcomePrompt(session.clinicName);
        return buildGather(welcomePrompt, stepUrl);
      }

      const index = parseInt(digit, 10) - 1;
      if (!isNaN(index) && session.doctors && session.doctors[index]) {
        const doctor = session.doctors[index];
        const dates = await listAvailableDates(doctor.id);
        if (dates.length === 0) {
          logger.warn("IVR doctor has no available dates", {
            callSid,
            tenantId: session.tenantId,
            doctorId: doctor.id,
          });
          // Graceful fallback: return to doctor selection rather than abrupt hangup
          return buildGather(
            `Sorry, no appointment dates are available for ${doctor.name}. Please select another doctor. ${buildDoctorMenuPrompt(
              session.doctors
            )}`,
            stepUrl
          );
        }
        await updateSession(callSid, {
          step: "select_date",
          selectedDoctorId: doctor.id,
          selectedDoctorName: doctor.name,
          dates,
          invalidCount: 0,
        });
        return buildGather(buildDateMenuPrompt(dates), stepUrl);
      } else {
        const replayPrompt = session.doctors
          ? buildDoctorMenuPrompt(session.doctors)
          : "Please select a doctor.";
        return handleInvalid(callSid, session, replayPrompt, isBlank);
      }
    }

    case "select_date": {
      if (digit === "*") {
        await updateSession(callSid, {
          step: "select_doctor",
          invalidCount: 0,
        });
        const doctorPrompt = session.doctors
          ? buildDoctorMenuPrompt(session.doctors)
          : "Please select a doctor.";
        return buildGather(doctorPrompt, stepUrl);
      }

      const index = parseInt(digit, 10) - 1;
      if (!isNaN(index) && session.dates && session.dates[index]) {
        const selectedDate = session.dates[index];
        const slots = await listAvailableSlots(
          session.selectedDoctorId!,
          selectedDate
        );
        if (slots.length === 0) {
          logger.warn("IVR selected date has no available slots", {
            callSid,
            tenantId: session.tenantId,
            doctorId: session.selectedDoctorId,
            selectedDate,
          });
          // Stay on select_date, reprompt date menu
          const datePrompt = buildDateMenuPrompt(session.dates);
          return buildGather(
            `Sorry, no slots are available on that date. ${datePrompt}`,
            stepUrl
          );
        }
        await updateSession(callSid, {
          step: "select_slot",
          selectedDate,
          slots: slots.map((s) => ({
            id: s.id,
            startTime: s.startTime,
            endTime: s.endTime,
          })),
          invalidCount: 0,
        });
        return buildGather(buildSlotMenuPrompt(slots), stepUrl);
      } else {
        const replayPrompt = session.dates
          ? buildDateMenuPrompt(session.dates)
          : "Please select a date.";
        return handleInvalid(callSid, session, replayPrompt, isBlank);
      }
    }

    case "select_slot": {
      if (digit === "*") {
        await updateSession(callSid, {
          step: "select_date",
          invalidCount: 0,
        });
        const datePrompt = session.dates
          ? buildDateMenuPrompt(session.dates)
          : "Please select a date.";
        return buildGather(datePrompt, stepUrl);
      }

      const index = parseInt(digit, 10) - 1;
      if (!isNaN(index) && session.slots && session.slots[index]) {
        const slot = session.slots[index];
        await updateSession(callSid, {
          step: "confirm",
          selectedSlotId: slot.id,
          selectedSlotTime: slot.startTime,
          invalidCount: 0,
        });
        return buildGather(
          buildConfirmPrompt(
            session.selectedDoctorName!,
            session.selectedDate!,
            slot.startTime
          ),
          stepUrl
        );
      } else {
        const replayPrompt = session.slots
          ? buildSlotMenuPrompt(session.slots)
          : "Please select a time.";
        return handleInvalid(callSid, session, replayPrompt, isBlank);
      }
    }

    case "confirm": {
      if (digit === "1") {
        const bookingResult = await executeIvrBooking(session);

        if (!bookingResult.success) {
          logger.warn("IVR slot race condition detected on booking", {
            callSid,
            tenantId: session.tenantId,
            slotId: session.selectedSlotId,
          });

          // Slot race condition: slot taken between selection and confirm
          if (bookingResult.freshSlots && bookingResult.freshSlots.length > 0) {
            await updateSession(callSid, {
              step: "select_slot",
              slots: bookingResult.freshSlots,
              invalidCount: 0,
            });
            return buildGather(
              "Sorry, that slot was just booked by someone else. Please select another slot. " +
                buildSlotMenuPrompt(bookingResult.freshSlots),
              stepUrl
            );
          }

          // If no fresh slots left on that date, fall back to date selection
          await updateSession(callSid, {
            step: "select_date",
            invalidCount: 0,
          });
          const datePrompt = session.dates
            ? buildDateMenuPrompt(session.dates)
            : "Please select another date.";
          return buildGather(
            `Sorry, all slots on that date are now booked. ${datePrompt}`,
            stepUrl
          );
        }

        await deleteSession(callSid);
        logger.info("IVR appointment booked successfully", {
          callSid,
          tenantId: session.tenantId,
          appointmentId: bookingResult.appointmentId,
          token: bookingResult.tokenNumber,
        });

        return buildHangup(buildConfirmedPrompt(bookingResult.tokenNumber));
      } else if (digit === "2") {
        await updateSession(callSid, { step: "welcome", invalidCount: 0 });
        const welcomePrompt = buildWelcomePrompt(session.clinicName);
        return buildGather(welcomePrompt, stepUrl);
      } else {
        const confirmPrompt = buildConfirmPrompt(
          session.selectedDoctorName!,
          session.selectedDate!,
          session.selectedSlotTime!
        );
        return handleInvalid(callSid, session, confirmPrompt, isBlank);
      }
    }

    default: {
      return buildHangup(
        "We are currently unavailable. Please call back later. Goodbye."
      );
    }
  }
}

/**
 * Handles hangup cleanup
 */
export async function handleHangupFlow(callSid?: string): Promise<void> {
  if (callSid) {
    await deleteSession(callSid);
    logger.info("IVR call ended and session cleaned up", { callSid });
  }
}

/**
 * Returns static fallback ExoML
 */
export function getFallbackXml(): string {
  return buildHangup(
    "We are currently unavailable. Please call back in a few minutes. Goodbye."
  );
}

/**
 * Returns IVR health payload
 */
export function getHealthStatus(): {
  status: string;
  provider: string;
  phase: number;
} {
  return { status: "ok", provider: "exotel", phase: 4 };
}

/**
 * Returns dynamic prompt text formatted for Exotel Gather applet based on call session state
 */
export async function getDynamicPromptText(
  callSid?: string,
  from?: string,
  to?: string
): Promise<string> {
  let session = callSid ? await getSession(callSid) : null;

  if (!session && to) {
    const tenant = await resolveTenantByIvrPhone(to);
    if (tenant && tenant.status === "active") {
      const doctors = await listActiveDoctors(tenant.id);
      session = {
        step: "welcome",
        tenantId: tenant.id,
        clinicName: tenant.name,
        callerPhone: from || "",
        doctors,
        invalidCount: 0,
      };
      if (callSid) {
        await createSession(callSid, session);
      }
    }
  }

  if (!session) {
    return "Namaste! Welcome to Demo Clinic. Press 1 to book an appointment. Press 0 to exit.";
  }

  switch (session.step) {
    case "welcome":
      return buildWelcomePrompt(session.clinicName);
    case "select_doctor":
      return buildDoctorMenuPrompt(session.doctors || []);
    case "select_date":
      return buildDateMenuPrompt(session.dates || []);
    case "select_slot":
      return buildSlotMenuPrompt(session.slots || []);
    case "confirm":
      return buildConfirmPrompt(
        session.selectedDoctorName || "Doctor",
        session.selectedDate || "",
        session.selectedSlotTime || ""
      );
    default:
      return "Thank you for calling. Goodbye.";
  }
}

