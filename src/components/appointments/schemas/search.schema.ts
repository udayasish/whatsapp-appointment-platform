import { z } from "zod";

export const searchAppointmentsSchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  status: z.enum(["booked", "completed", "cancelled", "noshow"]).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  scope: z.enum(["upcoming", "date", "all"]).default("date"),
});

export type SearchAppointmentsInput = z.infer<typeof searchAppointmentsSchema>;
