import type { Request, Response } from "express";
import { buildGather, buildHangup } from "../services/xml.service.js";
import {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  type IvrSession,
} from "../services/session.service.js";
import { resolveTenantByIvrPhone } from "../services/resolve-tenant.service.js";
import { listActiveDoctors } from "../../doctors/services/list-active-doctors.js";
import { listAvailableDates } from "../../slots/services/list-available-dates.js";
import { listAvailableSlots } from "../../slots/services/list-available-slots.js";
import { getOrCreatePatient } from "../../booking/services/get-or-create-patient.js";
import { createAppointmentFromBooking } from "../../appointments/services/create-appointment.js";
import {
  incomingCallSchema,
  dtmfStepSchema,
  hangupSchema,
} from "../schemas/ivr.schema.js";
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
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function buildDoctorMenuPrompt(
  doctors: { id: string; name: string; specialization: string | null }[]
): string {
  let prompt = "Please select a doctor. ";
  doctors.slice(0, 9).forEach((doc, idx) => {
    const spec = doc.specialization ? `, ${doc.specialization}` : "";
    prompt += `Press ${idx + 1} for ${doc.name}${spec}. `;
  });
  prompt += "Press star to exit.";
  return prompt;
}

function buildDateMenuPrompt(dates: string[]): string {
  let prompt = "Please select a date. ";
  dates.slice(0, 9).forEach((d, idx) => {
    prompt += `Press ${idx + 1} for ${formatDate(d)}. `;
  });
  prompt += "Press star to go back.";
  return prompt;
}

function buildSlotMenuPrompt(
  slots: { id: string; startTime: string; endTime: string }[]
): string {
  let prompt = "Please select a time. ";
  slots.slice(0, 9).forEach((s, idx) => {
    prompt += `Press ${idx + 1} for ${formatTime(s.startTime)}. `;
  });
  prompt += "Press star to go back.";
  return prompt;
}

function buildConfirmPrompt(
  doctorName: string,
  dateStr: string,
  timeStr: string
): string {
  return `You selected ${doctorName} on ${formatDate(dateStr)} at ${formatTime(
    timeStr
  )}. Press 1 to confirm. Press 2 to start over.`;
}

async function handleInvalid(
  callSid: string,
  session: IvrSession,
  replayPrompt: string,
  stepUrl: string,
  res: Response
): Promise<void> {
  const count = (session.invalidCount ?? 0) + 1;
  if (count >= 3) {
    await deleteSession(callSid);
    res.send(
      buildHangup("Too many invalid attempts. Please call back. Goodbye.")
    );
    return;
  }
  await updateSession(callSid, { invalidCount: count });
  res.send(
    buildGather(
      `Sorry, that was not a valid option. Please try again. ${replayPrompt}`,
      stepUrl
    )
  );
}

export async function handleIncomingCall(
  req: Request,
  res: Response
): Promise<void> {
  res.set("Content-Type", "text/xml");
  try {
    const parsed = incomingCallSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn("IVR incoming call invalid payload", {
        issues: parsed.error.issues,
      });
      res.send(
        buildHangup("We are currently unavailable. Please call back later. Goodbye.")
      );
      return;
    }

    const { CallSid, From, To } = parsed.data;
    const tenant = await resolveTenantByIvrPhone(To);

    if (!tenant || tenant.status !== "active") {
      logger.warn("IVR call for unknown or inactive tenant", {
        to: To,
        callSid: CallSid,
      });
      res.send(
        buildHangup(
          "Sorry, clinic not found or inactive. Please call back later. Goodbye."
        )
      );
      return;
    }

    const doctors = await listActiveDoctors(tenant.id);
    if (doctors.length === 0) {
      logger.warn("IVR call with no active doctors", {
        tenantId: tenant.id,
        callSid: CallSid,
      });
      res.send(
        buildHangup(
          "Sorry, no doctors are available right now. Please call back later. Goodbye."
        )
      );
      return;
    }

    await createSession(CallSid, {
      step: "welcome",
      tenantId: tenant.id,
      clinicName: tenant.name,
      callerPhone: From,
      doctors,
      invalidCount: 0,
    });

    logger.info("IVR incoming call", {
      callSid: CallSid,
      tenantId: tenant.id,
      callerPhone: From,
    });

    const stepUrl = `${env.APP_BASE_URL}/api/ivr/step`;
    const welcomePrompt = `Namaste! Welcome to ${tenant.name}. Press 1 to book an appointment. Press 0 to exit.`;
    res.send(buildGather(welcomePrompt, stepUrl));
  } catch (err) {
    logger.error("IVR error in handleIncomingCall", { err });
    res.send(
      buildHangup("Sorry, something went wrong. Please call back later. Goodbye.")
    );
  }
}

export async function handleStep(req: Request, res: Response): Promise<void> {
  res.set("Content-Type", "text/xml");
  const stepUrl = `${env.APP_BASE_URL}/api/ivr/step`;

  try {
    const parsed = dtmfStepSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn("IVR dtmfStep invalid payload", {
        issues: parsed.error.issues,
      });
      res.send(
        buildHangup("We are currently unavailable. Please call back later. Goodbye.")
      );
      return;
    }

    const { CallSid, Digits } = parsed.data;
    const digit = Digits.trim();
    const session = await getSession(CallSid);

    if (!session) {
      logger.warn("IVR session not found or expired", { callSid: CallSid });
      res.send(
        buildHangup("Your session has expired. Please call back. Goodbye.")
      );
      return;
    }

    logger.info("IVR step received", {
      callSid: CallSid,
      step: session.step,
      digit,
    });

    switch (session.step) {
      case "welcome": {
        if (digit === "1") {
          let doctors = session.doctors;
          if (!doctors || doctors.length === 0) {
            doctors = await listActiveDoctors(session.tenantId);
          }
          if (doctors.length === 0) {
            res.send(
              buildHangup(
                "Sorry, no doctors are available right now. Please call back later. Goodbye."
              )
            );
            return;
          }
          await updateSession(CallSid, {
            step: "select_doctor",
            doctors,
            invalidCount: 0,
          });
          res.send(buildGather(buildDoctorMenuPrompt(doctors), stepUrl));
          return;
        } else if (digit === "0") {
          await deleteSession(CallSid);
          res.send(buildHangup("Thank you for calling. Goodbye."));
          return;
        } else {
          const welcomePrompt = session.clinicName
            ? `Namaste! Welcome to ${session.clinicName}. Press 1 to book an appointment. Press 0 to exit.`
            : "Namaste! Welcome. Press 1 to book an appointment. Press 0 to exit.";
          await handleInvalid(CallSid, session, welcomePrompt, stepUrl, res);
          return;
        }
      }

      case "select_doctor": {
        if (digit === "*") {
          await updateSession(CallSid, { step: "welcome", invalidCount: 0 });
          const welcomePrompt = session.clinicName
            ? `Namaste! Welcome to ${session.clinicName}. Press 1 to book an appointment. Press 0 to exit.`
            : "Namaste! Welcome. Press 1 to book an appointment. Press 0 to exit.";
          res.send(buildGather(welcomePrompt, stepUrl));
          return;
        }

        const index = parseInt(digit, 10) - 1;
        if (!isNaN(index) && session.doctors && session.doctors[index]) {
          const doctor = session.doctors[index];
          const dates = await listAvailableDates(doctor.id);
          if (dates.length === 0) {
            res.send(
              buildHangup(
                "Sorry, no appointment dates are available for this doctor. Please call back later. Goodbye."
              )
            );
            return;
          }
          await updateSession(CallSid, {
            step: "select_date",
            selectedDoctorId: doctor.id,
            selectedDoctorName: doctor.name,
            dates,
            invalidCount: 0,
          });
          res.send(buildGather(buildDateMenuPrompt(dates), stepUrl));
          return;
        } else {
          const replayPrompt = session.doctors
            ? buildDoctorMenuPrompt(session.doctors)
            : "Please select a doctor.";
          await handleInvalid(CallSid, session, replayPrompt, stepUrl, res);
          return;
        }
      }

      case "select_date": {
        if (digit === "*") {
          await updateSession(CallSid, {
            step: "select_doctor",
            invalidCount: 0,
          });
          const doctorPrompt = session.doctors
            ? buildDoctorMenuPrompt(session.doctors)
            : "Please select a doctor.";
          res.send(buildGather(doctorPrompt, stepUrl));
          return;
        }

        const index = parseInt(digit, 10) - 1;
        if (!isNaN(index) && session.dates && session.dates[index]) {
          const selectedDate = session.dates[index];
          const slots = await listAvailableSlots(
            session.selectedDoctorId!,
            selectedDate
          );
          if (slots.length === 0) {
            const datePrompt = buildDateMenuPrompt(session.dates);
            res.send(
              buildGather(
                `Sorry, no slots are available on that date. ${datePrompt}`,
                stepUrl
              )
            );
            return;
          }
          await updateSession(CallSid, {
            step: "select_slot",
            selectedDate,
            slots: slots.map((s) => ({
              id: s.id,
              startTime: s.startTime,
              endTime: s.endTime,
            })),
            invalidCount: 0,
          });
          res.send(buildGather(buildSlotMenuPrompt(slots), stepUrl));
          return;
        } else {
          const replayPrompt = session.dates
            ? buildDateMenuPrompt(session.dates)
            : "Please select a date.";
          await handleInvalid(CallSid, session, replayPrompt, stepUrl, res);
          return;
        }
      }

      case "select_slot": {
        if (digit === "*") {
          await updateSession(CallSid, {
            step: "select_date",
            invalidCount: 0,
          });
          const datePrompt = session.dates
            ? buildDateMenuPrompt(session.dates)
            : "Please select a date.";
          res.send(buildGather(datePrompt, stepUrl));
          return;
        }

        const index = parseInt(digit, 10) - 1;
        if (!isNaN(index) && session.slots && session.slots[index]) {
          const slot = session.slots[index];
          await updateSession(CallSid, {
            step: "confirm",
            selectedSlotId: slot.id,
            selectedSlotTime: slot.startTime,
            invalidCount: 0,
          });
          res.send(
            buildGather(
              buildConfirmPrompt(
                session.selectedDoctorName!,
                session.selectedDate!,
                slot.startTime
              ),
              stepUrl
            )
          );
          return;
        } else {
          const replayPrompt = session.slots
            ? buildSlotMenuPrompt(session.slots)
            : "Please select a time.";
          await handleInvalid(CallSid, session, replayPrompt, stepUrl, res);
          return;
        }
      }

      case "confirm": {
        if (digit === "1") {
          const patient = await getOrCreatePatient(
            session.tenantId,
            session.callerPhone,
            null
          );
          const appointment = await createAppointmentFromBooking({
            tenantId: session.tenantId,
            doctorId: session.selectedDoctorId!,
            patientId: patient.id,
            slotId: session.selectedSlotId!,
            appointmentDate: session.selectedDate!,
            appointmentTime: session.selectedSlotTime!,
            patientName: patient.name || "Phone Caller",
            patientAge: 30,
            complaint: "Booked via IVR",
          });

          if (!appointment) {
            // Slot race condition: slot taken between selection and confirm
            const freshSlots = await listAvailableSlots(
              session.selectedDoctorId!,
              session.selectedDate!
            );
            await updateSession(CallSid, {
              step: "select_slot",
              slots: freshSlots.map((s) => ({
                id: s.id,
                startTime: s.startTime,
                endTime: s.endTime,
              })),
              invalidCount: 0,
            });
            res.send(
              buildGather(
                "Sorry, that slot was just booked by someone else. Please select another slot. " +
                  buildSlotMenuPrompt(freshSlots),
                stepUrl
              )
            );
            return;
          }

          await deleteSession(CallSid);
          logger.info("IVR appointment booked successfully", {
            callSid: CallSid,
            appointmentId: appointment.id,
            token: appointment.tokenNumber,
          });

          res.send(
            buildHangup(
              `Your appointment is confirmed. Your token number is ${appointment.tokenNumber}. Thank you for calling. Goodbye.`
            )
          );
          return;
        } else if (digit === "2") {
          await updateSession(CallSid, { step: "welcome", invalidCount: 0 });
          const welcomePrompt = session.clinicName
            ? `Namaste! Welcome to ${session.clinicName}. Press 1 to book an appointment. Press 0 to exit.`
            : "Namaste! Welcome. Press 1 to book an appointment. Press 0 to exit.";
          res.send(buildGather(welcomePrompt, stepUrl));
          return;
        } else {
          const confirmPrompt = buildConfirmPrompt(
            session.selectedDoctorName!,
            session.selectedDate!,
            session.selectedSlotTime!
          );
          await handleInvalid(CallSid, session, confirmPrompt, stepUrl, res);
          return;
        }
      }

      default: {
        res.send(
          buildHangup(
            "We are currently unavailable. Please call back later. Goodbye."
          )
        );
        return;
      }
    }
  } catch (err) {
    logger.error("IVR error in handleStep", { err });
    res.send(
      buildHangup("Sorry, something went wrong. Please call back. Goodbye.")
    );
  }
}

export async function handleHangup(req: Request, res: Response): Promise<void> {
  try {
    const parsed = hangupSchema.safeParse(req.body);
    const callSid = parsed.success
      ? parsed.data.CallSid
      : (req.body?.CallSid as string);
    if (callSid) {
      await deleteSession(callSid);
      logger.info("IVR call ended and session cleaned up", { callSid });
    }
  } catch (err) {
    logger.warn("IVR error in handleHangup", { err });
  }
  res.sendStatus(200);
}

export function handleFallback(_req: Request, res: Response): void {
  res.set("Content-Type", "text/xml");
  res.send(
    buildHangup(
      "We are currently unavailable. Please call back in a few minutes. Goodbye."
    )
  );
}

export function handleHealth(_req: Request, res: Response): void {
  res.json({ status: "ok", provider: "exotel", phase: 2 });
}
