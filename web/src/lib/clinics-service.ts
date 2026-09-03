import { apiFetch } from "./api";
import type { Clinic } from "@/types/api";

export interface CreateClinicInput {
  name: string;
  whatsappPhoneNumberId: string;
  whatsappDisplayNumber: string;
  doctorName?: string;
  specialization?: string;
  timezone?: string;
}

export const clinicsService = {
  list: () => apiFetch<Clinic[]>("/api/admin/tenants"),

  create: (body: CreateClinicInput) =>
    apiFetch<Clinic>("/api/admin/tenants", { method: "POST", body }),

  updateSettings: (
    id: string,
    body: { remindersEnabled?: boolean; notificationsEnabled?: boolean }
  ) =>
    apiFetch<Clinic>(`/api/admin/tenants/${id}/settings`, {
      method: "PATCH",
      body,
    }),

  updateStatus: (id: string, status: "active" | "suspended" | "inactive") =>
    apiFetch<Clinic>(`/api/admin/tenants/${id}/status`, {
      method: "PATCH",
      body: { status },
    }),

  getQrInfo: (id: string) =>
    apiFetch<{
      tenantId: string;
      clinicName: string;
      displayPhone: string;
      waMeUrl: string;
      posterUrl: string;
      qrPngUrl: string;
      qrSvgUrl: string;
    }>(`/api/admin/tenants/${id}/qr`),
};
