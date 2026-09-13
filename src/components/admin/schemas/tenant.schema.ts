import { z } from "zod";

export const createTenantSchema = z.object({
  name: z.string().min(1),
  whatsappPhoneNumberId: z.string().min(1),
  whatsappDisplayNumber: z.string().min(1),
  doctorName: z.string().optional(),
  specialization: z.string().optional(),
  timezone: z.string().default("Asia/Kolkata"),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export const tenantStatusSchema = z.object({
  status: z.enum(["active", "inactive", "suspended"]),
});

export type TenantStatusInput = z.infer<typeof tenantStatusSchema>;

export const tenantSettingsSchema = z
  .object({
    remindersEnabled: z.boolean().optional(),
    notificationsEnabled: z.boolean().optional(),
  })
  .refine(
    (v) => v.remindersEnabled !== undefined || v.notificationsEnabled !== undefined,
    { message: "At least one of remindersEnabled/notificationsEnabled must be provided" }
  );

export type TenantSettingsInput = z.infer<typeof tenantSettingsSchema>;
