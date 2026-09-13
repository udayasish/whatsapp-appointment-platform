import { z } from "zod";

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(["booked", "completed", "noshow", "cancelled"]),
  cancelReason: z.string().max(500).optional(),
});

export type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusSchema>;

export const createAppointmentSchema = z.object({
  tenantId: z.string().uuid(),
  doctorId: z.string().uuid(),
  patientId: z.string().uuid(),
  slotId: z.string().uuid(),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  appointmentTime: z.string(),
  patientName: z.string().min(1),
  patientAge: z.number().int().positive(),
  complaint: z.string().optional().nullable(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
