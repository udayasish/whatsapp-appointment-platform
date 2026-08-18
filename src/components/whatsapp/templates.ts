/**
 * Registry of the WhatsApp message templates this app sends outside an open
 * 24-hour customer service window (reminders, staff alerts). Meta rejects
 * free-form text for these — they must go through a pre-approved template.
 *
 * Each template uses NAMED parameters (Meta's `parameter_format: "NAMED"`)
 * so the send-time payload is self-describing instead of positional {{1}},
 * {{2}} magic numbers. `TEMPLATE_DEFINITIONS` is what gets registered with
 * Meta (see scripts/register-templates.ts); the `build*Components` helpers
 * are what the queue workers use to fill in the dynamic values per send.
 *
 * WhatsApp does not support Assamese as a template language (only the
 * booking bot's live conversation does) — see supported-languages docs —
 * so these are English-only regardless of the patient's chosen language.
 */

export type TemplateName =
  | "appointment_reminder"
  | "doctor_new_booking_alert"
  | "doctor_daily_summary";

export const TEMPLATE_LANGUAGE = "en_US";

interface NamedTextParam {
  type: "text";
  parameter_name: string;
  text: string;
}

interface TemplateBodyComponent {
  type: "body";
  parameters: NamedTextParam[];
}

function namedParams(values: Record<string, string>): NamedTextParam[] {
  return Object.entries(values).map(([parameter_name, text]) => ({
    type: "text" as const,
    parameter_name,
    text,
  }));
}

// ---------------------------------------------------------------------------
// Registration-time definitions (what Meta reviews and approves).
// ---------------------------------------------------------------------------

export interface TemplateDefinition {
  name: TemplateName;
  category: "UTILITY";
  language: string;
  parameter_format: "NAMED";
  components: Record<string, unknown>[];
}

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    name: "appointment_reminder",
    category: "UTILITY",
    language: TEMPLATE_LANGUAGE,
    parameter_format: "NAMED",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Appointment Reminder",
      },
      {
        type: "BODY",
        text:
          "This is a friendly reminder about your upcoming appointment at *{{clinic_name}}* " +
          "with Dr. {{doctor_name}}.\n\n" +
          "Date: *{{appointment_date}}*\nTime: *{{appointment_time}}*\n" +
          "Patient: *{{patient_name}}*\nQueue number: *{{token_number}}*\n\n" +
          "Please arrive 10 minutes early for your visit.",
        example: {
          body_text_named_params: [
            { param_name: "clinic_name", example: "Sunrise Clinic" },
            { param_name: "doctor_name", example: "Anjali Rao" },
            { param_name: "appointment_date", example: "12 August 2026" },
            { param_name: "appointment_time", example: "10:30 AM" },
            { param_name: "patient_name", example: "Priya Sharma" },
            { param_name: "token_number", example: "14" },
          ],
        },
      },
      {
        type: "FOOTER",
        text: "Automated appointment notification · ClinicConnect",
      },
    ],
  },
  {
    name: "doctor_new_booking_alert",
    category: "UTILITY",
    language: TEMPLATE_LANGUAGE,
    parameter_format: "NAMED",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "New Appointment Booked",
      },
      {
        type: "BODY",
        text:
          "A new appointment has been scheduled at *{{clinic_name}}* for Dr. {{doctor_name}}.\n\n" +
          "Patient: *{{patient_name}}*\nAppointment ID: *{{token_number}}*\n" +
          "Date: *{{appointment_date}}*\nTime: *{{appointment_time}}*\n" +
          "Reason for visit: {{complaint}}\n\n" +
          "Please review your upcoming schedule.",
        example: {
          body_text_named_params: [
            { param_name: "clinic_name", example: "Sunrise Clinic" },
            { param_name: "doctor_name", example: "Anjali Rao" },
            { param_name: "patient_name", example: "Rohit Sharma" },
            { param_name: "token_number", example: "14" },
            { param_name: "appointment_date", example: "12 August 2026" },
            { param_name: "appointment_time", example: "10:30 AM" },
            { param_name: "complaint", example: "Recurring headache" },
          ],
        },
      },
      {
        type: "FOOTER",
        text: "Automated staff notification · ClinicConnect",
      },
    ],
  },
  {
    name: "doctor_daily_summary",
    category: "UTILITY",
    language: TEMPLATE_LANGUAGE,
    parameter_format: "NAMED",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Today's Schedule",
      },
      {
        type: "BODY",
        text:
          "Good morning, Dr. {{doctor_name}}! Here is your schedule at *{{clinic_name}}* " +
          "for *{{today_date}}*.\n\n{{appointments_list}}\n\nHave a great day!",
        example: {
          body_text_named_params: [
            { param_name: "doctor_name", example: "Anjali Rao" },
            { param_name: "clinic_name", example: "Sunrise Clinic" },
            { param_name: "today_date", example: "12 August 2026" },
            {
              param_name: "appointments_list",
              example: "#12 — Rohit Sharma at 9:00 AM\n#13 — Meena Das at 9:30 AM",
            },
          ],
        },
      },
      {
        type: "FOOTER",
        text: "Reply TODAY anytime for the latest.",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Send-time component builders (what the queue workers call).
// ---------------------------------------------------------------------------

export function buildAppointmentReminderComponents(params: {
  patientName: string;
  clinicName: string;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
  tokenNumber: string;
}): TemplateBodyComponent[] {
  return [
    {
      type: "body",
      parameters: namedParams({
        patient_name: params.patientName,
        clinic_name: params.clinicName,
        doctor_name: params.doctorName,
        appointment_date: params.appointmentDate,
        appointment_time: params.appointmentTime,
        token_number: params.tokenNumber,
      }),
    },
  ];
}

export function buildDoctorNewBookingAlertComponents(params: {
  doctorName: string;
  clinicName: string;
  patientName: string;
  tokenNumber: string;
  appointmentDate: string;
  appointmentTime: string;
  complaint: string;
}): TemplateBodyComponent[] {
  return [
    {
      type: "body",
      parameters: namedParams({
        doctor_name: params.doctorName,
        clinic_name: params.clinicName,
        patient_name: params.patientName,
        token_number: params.tokenNumber,
        appointment_date: params.appointmentDate,
        appointment_time: params.appointmentTime,
        complaint: params.complaint,
      }),
    },
  ];
}

export function buildDoctorDailySummaryComponents(params: {
  doctorName: string;
  clinicName: string;
  todayDate: string;
  appointmentsList: string;
}): TemplateBodyComponent[] {
  return [
    {
      type: "body",
      parameters: namedParams({
        doctor_name: params.doctorName,
        clinic_name: params.clinicName,
        today_date: params.todayDate,
        appointments_list: params.appointmentsList,
      }),
    },
  ];
}
