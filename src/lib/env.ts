import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().min(1),
  WHATSAPP_APP_SECRET: z.string().min(1),
  WHATSAPP_ACCESS_TOKEN: z.string().min(1),
  WHATSAPP_API_VERSION: z.string().default("v21.0"),
  // Only needed for scripts/register-templates.ts — the WABA that owns the
  // message templates, not the per-tenant phone_number_id used elsewhere.
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  // Overridable so local/dev testing can point at a mock server instead of
  // making real calls to Meta.
  WHATSAPP_GRAPH_API_BASE_URL: z.url().default("https://graph.facebook.com"),
  BOOKING_HORIZON_DAYS: z.coerce.number().int().positive().default(10),
  // --- Admin web interface ---
  // bcrypt hash of the single admin password — never store the plaintext.
  ADMIN_PASSWORD_HASH: z.string().min(1),
  // Signs the admin session cookie.
  SESSION_SECRET: z.string().min(16),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
