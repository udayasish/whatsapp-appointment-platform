import type { Lang } from "./types.js";

type MessageKey =
  | "languagePrompt"
  | "actionPrompt"
  | "bookButtonLabel"
  | "viewButtonLabel"
  | "confirmButtonLabel"
  | "cancelButtonLabel"
  | "chooseDoctorButtonLabel"
  | "chooseDateButtonLabel"
  | "chooseTimeButtonLabel"
  | "noDoctors"
  | "doctorListHeader"
  | "invalidGeneric"
  | "noDates"
  | "dateListHeader"
  | "noSlots"
  | "slotListHeader"
  | "enterNamePrompt"
  | "invalidName"
  | "enterAgePrompt"
  | "invalidAge"
  | "enterComplaintPrompt"
  | "invalidComplaint"
  | "confirmHeader"
  | "bookingSuccess"
  | "bookingFailedSlotTaken"
  | "cancelled"
  | "viewAppointmentsHeader"
  | "noUpcomingAppointments"
  | "nothingToGoBackTo";

const STRINGS: Record<Lang, Record<MessageKey, string>> = {
  en: {
    languagePrompt:
      "👋 *Welcome to {{clinicName}}!*\n\nPlease select your language:\n\n_Tip: reply *BACK* to return to the previous step, or *CANCEL* to start over — anytime._",
    actionPrompt: "🗓️ *What would you like to do?*",
    bookButtonLabel: "Book appointment",
    viewButtonLabel: "View appointments",
    confirmButtonLabel: "Confirm",
    cancelButtonLabel: "Cancel",
    chooseDoctorButtonLabel: "Choose a doctor",
    chooseDateButtonLabel: "Choose a date",
    chooseTimeButtonLabel: "Choose a time",
    noDoctors: "⚠️ Sorry, there are no doctors available to book with right now. Please try again later.",
    doctorListHeader: "👨‍⚕️ *Please choose a doctor:*",
    invalidGeneric: "❓ Sorry, I didn't understand that. Please try again.",
    noDates: "⚠️ Sorry, that doctor has no available dates right now. Please try again later.",
    dateListHeader: "📅 *Please choose a date:*",
    noSlots: "⚠️ Sorry, no time slots are available on that date anymore. Please choose another date:",
    slotListHeader: "⏰ *Please choose a time slot:*",
    enterNamePrompt: "🧑 *What is the patient's full name?*",
    invalidName: "❓ Please enter a valid name (at least 2 characters).",
    enterAgePrompt: "🎂 *What is the patient's age?*",
    invalidAge: "❓ Please enter a valid age (a number between 0 and 120).",
    enterComplaintPrompt: "📝 *Please briefly describe the reason for the visit.*",
    invalidComplaint: "❓ Please enter a short description (at least 3 characters).",
    confirmHeader: "✅ *Please confirm your appointment:*",
    bookingSuccess:
      "🎉 *Your appointment is confirmed!*\n\n🎫 Token number: *{{token}}*\n👨‍⚕️ Doctor: *{{doctorName}}*\n📅 Date: *{{date}}*\n⏰ Time: *{{time}}*\n\n_Please arrive 10 minutes early._",
    bookingFailedSlotTaken:
      "⚠️ Sorry, that time slot was just booked by someone else. Please start again to pick another slot.",
    cancelled: "❌ Your booking has been cancelled.\n\n_Send any message to start again._",
    viewAppointmentsHeader: "📋 *Your upcoming appointments:*",
    noUpcomingAppointments: "You have no upcoming appointments.",
    nothingToGoBackTo: "↩️ You're at the first step, there's nothing to go back to.",
  },
  as: {
    languagePrompt:
      "👋 *{{clinicName}} লৈ আপোনাক স্বাগতম!*\n\nঅনুগ্ৰহ কৰি আপোনাৰ ভাষা বাছনি কৰক:\n\n_পৰামৰ্শ: যিকোনো সময়তে পূৰ্বৰ পৰ্যায়লৈ যাবলৈ *BACK*, বা আৰম্ভণিৰ পৰা কৰিবলৈ *CANCEL* পঠিয়াওক।_",
    actionPrompt: "🗓️ *আপুনি কি কৰিব বিচাৰে?*",
    bookButtonLabel: "বুকিং কৰক",
    viewButtonLabel: "এপইণ্টমেণ্ট চাওক",
    confirmButtonLabel: "নিশ্চিত কৰক",
    cancelButtonLabel: "বাতিল কৰক",
    chooseDoctorButtonLabel: "ডাক্তৰ বাছনি কৰক",
    chooseDateButtonLabel: "তাৰিখ বাছনি কৰক",
    chooseTimeButtonLabel: "সময় বাছনি কৰক",
    noDoctors:
      "⚠️ দুখিত, এই মুহূৰ্তত বুকিঙৰ বাবে কোনো ডাক্তৰ উপলব্ধ নাই। অনুগ্ৰহ কৰি পিছত পুনৰ চেষ্টা কৰক।",
    doctorListHeader: "👨‍⚕️ *অনুগ্ৰহ কৰি ডাক্তৰ বাছনি কৰক:*",
    invalidGeneric: "❓ দুখিত, মই সেয়া বুজি নাপালোঁ। অনুগ্ৰহ কৰি পুনৰ চেষ্টা কৰক।",
    noDates:
      "⚠️ দুখিত, এই ডাক্তৰৰ বাবে এতিয়া কোনো তাৰিখ উপলব্ধ নাই। অনুগ্ৰহ কৰি পিছত পুনৰ চেষ্টা কৰক।",
    dateListHeader: "📅 *অনুগ্ৰহ কৰি তাৰিখ বাছনি কৰক:*",
    noSlots:
      "⚠️ দুখিত, সেই তাৰিখত আৰু কোনো সময় উপলব্ধ নাই। অনুগ্ৰহ কৰি আন এটা তাৰিখ বাছনি কৰক:",
    slotListHeader: "⏰ *অনুগ্ৰহ কৰি সময় বাছনি কৰক:*",
    enterNamePrompt: "🧑 *ৰোগীৰ সম্পূৰ্ণ নাম কি?*",
    invalidName: "❓ অনুগ্ৰহ কৰি এটা বৈধ নাম দিয়ক (কমেও 2 আখৰ)।",
    enterAgePrompt: "🎂 *ৰোগীৰ বয়স কিমান?*",
    invalidAge: "❓ অনুগ্ৰহ কৰি এটা বৈধ বয়স দিয়ক (0 ৰ পৰা 120ৰ মাজৰ এটা সংখ্যা)।",
    enterComplaintPrompt: "📝 *অনুগ্ৰহ কৰি চমুকৈ আহিবৰ কাৰণ বৰ্ণনা কৰক।*",
    invalidComplaint: "❓ অনুগ্ৰহ কৰি এটা চমু বিৱৰণ দিয়ক (কমেও 3 আখৰ)।",
    confirmHeader: "✅ *অনুগ্ৰহ কৰি আপোনাৰ এপইণ্টমেণ্ট নিশ্চিত কৰক:*",
    bookingSuccess:
      "🎉 *আপোনাৰ এপইণ্টমেণ্ট নিশ্চিত কৰা হ'ল!*\n\n🎫 টোকেন নম্বৰ: *{{token}}*\n👨‍⚕️ ডাক্তৰ: *{{doctorName}}*\n📅 তাৰিখ: *{{date}}*\n⏰ সময়: *{{time}}*\n\n_অনুগ্ৰহ কৰি 10 মিনিট আগতে উপস্থিত হ'ব।_",
    bookingFailedSlotTaken:
      "⚠️ দুখিত, সেই সময়টো আনৰ দ্বাৰা বুক কৰা হৈ গৈছে। অনুগ্ৰহ কৰি আন এটা সময় বাছনি কৰিবলৈ পুনৰ আৰম্ভ কৰক।",
    cancelled:
      "❌ আপোনাৰ বুকিং বাতিল কৰা হৈছে।\n\n_পুনৰ আৰম্ভ কৰিবলৈ যিকোনো বাৰ্তা পঠিয়াওক।_",
    viewAppointmentsHeader: "📋 *আপোনাৰ আগন্তুক এপইণ্টমেণ্টসমূহ:*",
    noUpcomingAppointments: "আপোনাৰ কোনো আগন্তুক এপইণ্টমেণ্ট নাই।",
    nothingToGoBackTo: "↩️ আপুনি একেবাৰে প্ৰথম পৰ্যায়ত আছে, ইয়াৰ আগত উভতি যাবলৈ একো নাই।",
  },
};

export function t(
  lang: Lang,
  key: MessageKey,
  vars?: Record<string, string | number>
): string {
  let text = STRINGS[lang][key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{{${k}}}`, String(v));
    }
  }
  return text;
}
