import { buildGather, buildHangup } from "./xml.service.js";
import {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  savePrecomputedPrompt,
  getPrecomputedPrompt,
  savePrefetchedData,
  getPrefetchedData,
  saveIvrCallDataPipeline,
  cleanupAllCallKeys,
  type IvrSession,
  type IvrPrefetchedData,
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
    await cleanupAllCallKeys(callSid);
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
  const combinedPrompt = `${prefix} ${replayPrompt}`;
  await savePrecomputedPrompt(callSid, session.step, combinedPrompt);
  return buildGather(combinedPrompt, stepUrl);
}

/**
 * Pre-computes and caches all clinic, doctor, date, and slot data for a call
 * into Redis using an atomic pipeline during session init.
 */
export async function precomputeIvrData(
  callSid: string,
  from: string,
  to: string
): Promise<{ tenantName: string; stepUrl: string }> {
  const stepUrl = getStepUrl();
  try {
    const tenant = await resolveTenantByIvrPhone(to);
    if (!tenant || tenant.status !== "active") {
      logger.warn("IVR precompute: unknown or inactive tenant", { to, callSid });
      const defaultWelcome = buildWelcomePrompt();
      await savePrecomputedPrompt(callSid, "welcome", defaultWelcome);
      return { tenantName: "Demo Clinic", stepUrl };
    }

    const doctors = await listActiveDoctors(tenant.id);
    const doctorDates: Record<string, string[]> = {};
    const doctorDateSlots: Record<string, { id: string; startTime: string; endTime: string }[]> = {};

    // Pre-fetch available dates for each active doctor (up to 5 doctors)
    await Promise.all(
      doctors.slice(0, 5).map(async (doc) => {
        try {
          const dates = await listAvailableDates(doc.id, 5);
          doctorDates[doc.id] = dates;

          // Pre-fetch slots for the first 2 dates of this doctor
          await Promise.all(
            dates.slice(0, 2).map(async (d) => {
              try {
                const slots = await listAvailableSlots(doc.id, d);
                doctorDateSlots[`${doc.id}:${d}`] = slots.map((s) => ({
                  id: s.id,
                  startTime: s.startTime,
                  endTime: s.endTime,
                }));
              } catch (err) {
                logger.warn("IVR precompute slot fetch failed", { docId: doc.id, date: d, err });
              }
            })
          );
        } catch (err) {
          logger.warn("IVR precompute date fetch failed", { docId: doc.id, err });
        }
      })
    );

    const session: IvrSession = {
      step: "welcome",
      tenantId: tenant.id,
      clinicName: tenant.name,
      callerPhone: from,
      doctors,
      invalidCount: 0,
    };

    const prefetchedData: IvrPrefetchedData = {
      tenant: { id: tenant.id, name: tenant.name, status: tenant.status },
      doctors,
      doctorDates,
      doctorDateSlots,
    };

    const welcomePrompt = buildWelcomePrompt(tenant.name);
    const selectDoctorPrompt = buildDoctorMenuPrompt(doctors);

    await saveIvrCallDataPipeline(callSid, session, prefetchedData, {
      welcome: welcomePrompt,
      select_doctor: selectDoctorPrompt,
    });

    logger.info("IVR precomputed data pipeline stored successfully", {
      callSid,
      tenantId: tenant.id,
      clinicName: tenant.name,
      doctorsCount: doctors.length,
    });

    return { tenantName: tenant.name, stepUrl };
  } catch (err) {
    logger.error("IVR precompute error, falling back to resilient default", { callSid, err });
    const fallbackPrompt = buildWelcomePrompt("Demo Clinic");
    await savePrecomputedPrompt(callSid, "welcome", fallbackPrompt);
    return { tenantName: "Demo Clinic", stepUrl };
  }
}

/**
 * Handles incoming call flow:
 * Pre-computes clinic dataset, initializes session in Redis via pipeline,
 * and returns the welcome ExoML response.
 */
export async function handleIncomingCallFlow(
  callSid: string,
  from: string,
  to: string
): Promise<string> {
  const { tenantName, stepUrl } = await precomputeIvrData(callSid, from, to);
  const welcomePrompt = buildWelcomePrompt(tenantName);
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
          const prefetched = await getPrefetchedData(callSid);
          doctors = prefetched?.doctors;
          if (!doctors || doctors.length === 0) {
            doctors = await listActiveDoctors(session.tenantId);
          }
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
        const doctorPrompt = buildDoctorMenuPrompt(doctors);
        await savePrecomputedPrompt(callSid, "select_doctor", doctorPrompt);
        await updateSession(callSid, {
          step: "select_doctor",
          doctors,
          invalidCount: 0,
        });
        return buildGather(doctorPrompt, stepUrl);
      } else if (digit === "0") {
        await cleanupAllCallKeys(callSid);
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
        const welcomePrompt = buildWelcomePrompt(session.clinicName);
        await savePrecomputedPrompt(callSid, "welcome", welcomePrompt);
        await updateSession(callSid, { step: "welcome", invalidCount: 0 });
        return buildGather(welcomePrompt, stepUrl);
      }

      const index = parseInt(digit, 10) - 1;
      if (!isNaN(index) && session.doctors && session.doctors[index]) {
        const doctor = session.doctors[index];
        const prefetched = await getPrefetchedData(callSid);
        let dates = prefetched?.doctorDates?.[doctor.id];
        if (!dates || dates.length === 0) {
          dates = await listAvailableDates(doctor.id);
        }
        if (dates.length === 0) {
          logger.warn("IVR doctor has no available dates", {
            callSid,
            tenantId: session.tenantId,
            doctorId: doctor.id,
          });
          const doctorPrompt = buildDoctorMenuPrompt(session.doctors);
          await savePrecomputedPrompt(callSid, "select_doctor", doctorPrompt);
          return buildGather(
            `Sorry, no appointment dates are available for ${doctor.name}. Please select another doctor. ${doctorPrompt}`,
            stepUrl
          );
        }
        const datePrompt = buildDateMenuPrompt(dates);
        await savePrecomputedPrompt(callSid, "select_date", datePrompt);
        await updateSession(callSid, {
          step: "select_date",
          selectedDoctorId: doctor.id,
          selectedDoctorName: doctor.name,
          dates,
          invalidCount: 0,
        });
        return buildGather(datePrompt, stepUrl);
      } else {
        const replayPrompt = session.doctors
          ? buildDoctorMenuPrompt(session.doctors)
          : "Please select a doctor.";
        return handleInvalid(callSid, session, replayPrompt, isBlank);
      }
    }

    case "select_date": {
      if (digit === "*") {
        const doctorPrompt = session.doctors
          ? buildDoctorMenuPrompt(session.doctors)
          : "Please select a doctor.";
        await savePrecomputedPrompt(callSid, "select_doctor", doctorPrompt);
        await updateSession(callSid, {
          step: "select_doctor",
          invalidCount: 0,
        });
        return buildGather(doctorPrompt, stepUrl);
      }

      const index = parseInt(digit, 10) - 1;
      if (!isNaN(index) && session.dates && session.dates[index]) {
        const selectedDate = session.dates[index];
        const prefetched = await getPrefetchedData(callSid);
        let slots = prefetched?.doctorDateSlots?.[`${session.selectedDoctorId}:${selectedDate}`];
        if (!slots || slots.length === 0) {
          const freshSlots = await listAvailableSlots(
            session.selectedDoctorId!,
            selectedDate
          );
          slots = freshSlots.map((s) => ({
            id: s.id,
            startTime: s.startTime,
            endTime: s.endTime,
          }));
        }
        if (slots.length === 0) {
          logger.warn("IVR selected date has no available slots", {
            callSid,
            tenantId: session.tenantId,
            doctorId: session.selectedDoctorId,
            selectedDate,
          });
          const datePrompt = buildDateMenuPrompt(session.dates);
          await savePrecomputedPrompt(callSid, "select_date", datePrompt);
          return buildGather(
            `Sorry, no slots are available on that date. ${datePrompt}`,
            stepUrl
          );
        }
        const slotPrompt = buildSlotMenuPrompt(slots);
        await savePrecomputedPrompt(callSid, "select_slot", slotPrompt);
        await updateSession(callSid, {
          step: "select_slot",
          selectedDate,
          slots,
          invalidCount: 0,
        });
        return buildGather(slotPrompt, stepUrl);
      } else {
        const replayPrompt = session.dates
          ? buildDateMenuPrompt(session.dates)
          : "Please select a date.";
        return handleInvalid(callSid, session, replayPrompt, isBlank);
      }
    }

    case "select_slot": {
      if (digit === "*") {
        const datePrompt = session.dates
          ? buildDateMenuPrompt(session.dates)
          : "Please select a date.";
        await savePrecomputedPrompt(callSid, "select_date", datePrompt);
        await updateSession(callSid, {
          step: "select_date",
          invalidCount: 0,
        });
        return buildGather(datePrompt, stepUrl);
      }

      const index = parseInt(digit, 10) - 1;
      if (!isNaN(index) && session.slots && session.slots[index]) {
        const slot = session.slots[index];
        const confirmPrompt = buildConfirmPrompt(
          session.selectedDoctorName!,
          session.selectedDate!,
          slot.startTime
        );
        await savePrecomputedPrompt(callSid, "confirm", confirmPrompt);
        await updateSession(callSid, {
          step: "confirm",
          selectedSlotId: slot.id,
          selectedSlotTime: slot.startTime,
          invalidCount: 0,
        });
        return buildGather(confirmPrompt, stepUrl);
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

          if (bookingResult.freshSlots && bookingResult.freshSlots.length > 0) {
            const slotPrompt = buildSlotMenuPrompt(bookingResult.freshSlots);
            await savePrecomputedPrompt(callSid, "select_slot", slotPrompt);
            await updateSession(callSid, {
              step: "select_slot",
              slots: bookingResult.freshSlots,
              invalidCount: 0,
            });
            return buildGather(
              "Sorry, that slot was just booked by someone else. Please select another slot. " +
                slotPrompt,
              stepUrl
            );
          }

          const datePrompt = session.dates
            ? buildDateMenuPrompt(session.dates)
            : "Please select another date.";
          await savePrecomputedPrompt(callSid, "select_date", datePrompt);
          await updateSession(callSid, {
            step: "select_date",
            invalidCount: 0,
          });
          return buildGather(
            `Sorry, all slots on that date are now booked. ${datePrompt}`,
            stepUrl
          );
        }

        await cleanupAllCallKeys(callSid);
        logger.info("IVR appointment booked successfully", {
          callSid,
          tenantId: session.tenantId,
          appointmentId: bookingResult.appointmentId,
          token: bookingResult.tokenNumber,
        });

        return buildHangup(buildConfirmedPrompt(bookingResult.tokenNumber));
      } else if (digit === "2") {
        const welcomePrompt = buildWelcomePrompt(session.clinicName);
        await savePrecomputedPrompt(callSid, "welcome", welcomePrompt);
        await updateSession(callSid, { step: "welcome", invalidCount: 0 });
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
    await cleanupAllCallKeys(callSid);
    logger.info("IVR call ended and all keys cleaned up", { callSid });
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
 * Returns pre-computed prompt text from Redis (< 2ms) for Exotel Gather applet.
 * Zero live DB queries. If cache miss, falls back to session in-memory state
 * or resilient clinic defaults and triggers background pre-fetch.
 */
export async function getPrecomputedPromptText(
  callSid?: string,
  from?: string,
  to?: string
): Promise<string> {
  if (callSid) {
    const session = await getSession(callSid);
    const step = session?.step || "welcome";
    const cached = await getPrecomputedPrompt(callSid, step);
    if (cached) {
      logger.info("IVR prompt served from Redis cache", { callSid, step });
      return cached;
    }

    if (session) {
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
      }
    }

    // Edge case: Flow started directly at Gather without prior Passthru.
    // Return instant welcome prompt (< 2ms) and asynchronously warm up data in background.
    if (to) {
      precomputeIvrData(callSid, from || "", to).catch((err) =>
        logger.error("IVR background precompute error", { callSid, err })
      );
    }
  }

  return buildWelcomePrompt("Demo Clinic");
}

export const getDynamicPromptText = getPrecomputedPromptText;

