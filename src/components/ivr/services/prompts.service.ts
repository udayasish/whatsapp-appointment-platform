export function formatIvrTime(timeStr: string): string {
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

export function formatIvrDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function buildWelcomePrompt(clinicName?: string): string {
  if (clinicName) {
    return `Namaste! Welcome to ${clinicName}. Press 1 to book an appointment. Press 0 to exit.`;
  }
  return "Namaste! Welcome. Press 1 to book an appointment. Press 0 to exit.";
}

export function buildDoctorMenuPrompt(
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

export function buildDateMenuPrompt(dates: string[]): string {
  let prompt = "Please select a date. ";
  dates.slice(0, 9).forEach((d, idx) => {
    prompt += `Press ${idx + 1} for ${formatIvrDate(d)}. `;
  });
  prompt += "Press star to go back.";
  return prompt;
}

export function buildSlotMenuPrompt(
  slots: { id: string; startTime: string; endTime: string }[]
): string {
  let prompt = "Please select a time. ";
  slots.slice(0, 9).forEach((s, idx) => {
    prompt += `Press ${idx + 1} for ${formatIvrTime(s.startTime)}. `;
  });
  prompt += "Press star to go back.";
  return prompt;
}

export function buildConfirmPrompt(
  doctorName: string,
  dateStr: string,
  timeStr: string
): string {
  return `You selected ${doctorName} on ${formatIvrDate(dateStr)} at ${formatIvrTime(
    timeStr
  )}. Press 1 to confirm. Press 2 to start over.`;
}

export function buildConfirmedPrompt(tokenNumber: number): string {
  return `Your appointment is confirmed. Your token number is ${tokenNumber}. Thank you for calling. Goodbye.`;
}
