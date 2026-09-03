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
  // Only needed for scripts/register-templates.ts
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  // Overridable so local/dev testing can point at a mock server instead of Meta.
  WHATSAPP_GRAPH_API_BASE_URL: z.url().default("https://graph.facebook.com"),
  BOOKING_HORIZON_DAYS: z.coerce.number().int().positive().default(10),
  // --- Admin dashboard JWT auth ---
  // Used to sign admin JWT access tokens. Must be at least 32 chars.
  ACCESS_TOKEN_SECRET: z
    .string()
    .min(16)
    .default("clinicconnect-access-token-secret-dev-32chars"),
  // How long the admin JWT stays valid. e.g. "7d", "24h"
  ACCESS_TOKEN_EXPIRATION: z.string().default("7d"),
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

