import { apiFetch } from "./api";
import type { Appointment } from "@/types/api";

export const queueService = {
  list: (tenantId: string, date?: string) => {
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    return apiFetch<Appointment[]>(`/api/admin/clinics/${tenantId}/queue${query}`);
  },

  updateStatus: (
    appointmentId: string,
    status: "booked" | "completed" | "noshow" | "cancelled"
  ) =>
    apiFetch<Appointment>(`/api/admin/appointments/${appointmentId}/status`, {
      method: "PATCH",
      body: { status },
    }),
};
