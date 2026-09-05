export type AdminRole = "super_admin" | "clinic_admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  tenantId: string | null;
  status: string;
}

export interface Clinic {
  id: string;
  name: string;
  whatsappDisplayNumber: string;
  whatsappPhoneNumberId: string;
  status: "active" | "suspended" | "inactive";
  remindersEnabled: boolean;
  notificationsEnabled: boolean;
  doctorName?: string;
  specialization?: string;
  waMeUrl?: string;
  posterUrl?: string;
  imageUrl?: string;
}

export interface Appointment {
  id: string;
  tokenNumber: number;
  patientName: string;
  patientAge: number;
  patientPhone: string;
  timeSlot: string;
  complaint?: string | null;
  status: "booked" | "completed" | "noshow" | "cancelled";
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
