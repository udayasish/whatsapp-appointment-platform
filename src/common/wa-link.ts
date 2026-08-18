/**
 * Normalizes any phone number format (e.g., "+91 70020 59544", "+1 (555) 000-1111", "919876543210")
 * into clean digits without leading '+' or special characters as required by WhatsApp Click-to-Chat URLs.
 */
export function sanitizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  // If the number starts with 00 (international call prefix), remove it
  if (cleaned.startsWith("00")) {
    cleaned = cleaned.slice(2);
  }
  return cleaned;
}

export interface WaMeLinkOptions {
  phone: string;
  text?: string;
}

/**
 * Constructs a standard WhatsApp Click-to-Chat deep link (wa.me)
 * Example: https://wa.me/917002059544?text=Hi
 */
export function generateWaMeLink({ phone, text = "Hi" }: WaMeLinkOptions): string {
  const cleanPhone = sanitizePhoneNumber(phone);
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}
