/**
 * One-off admin script: submits TEMPLATE_DEFINITIONS (src/components/whatsapp/templates.ts)
 * to the WABA for Meta's review. Run with: npm run templates:register
 *
 * Requires WHATSAPP_BUSINESS_ACCOUNT_ID in .env — this is the WABA ID (not the
 * per-tenant phone_number_id used elsewhere in the app). Find it at
 * business.facebook.com > WhatsApp Manager > API setup, or via
 * GET /{business_id}/owned_whatsapp_business_accounts.
 *
 * Safe to re-run: a template name is unique per WABA+language, so re-running
 * after editing TEMPLATE_DEFINITIONS edits the existing template in place
 * (POST /{template-id}) instead of trying — and failing — to create a
 * duplicate. Edited templates always go back to PENDING for re-review,
 * regardless of prior status (including REJECTED).
 */
import axios from "axios";
import { env } from "../lib/env.js";
import { TEMPLATE_DEFINITIONS } from "../components/whatsapp/templates.js";

async function main() {
  const wabaId = env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  if (!wabaId) {
    console.error(
      "WHATSAPP_BUSINESS_ACCOUNT_ID is not set in .env — add it before running this script."
    );
    process.exit(1);
  }

  const base = `${env.WHATSAPP_GRAPH_API_BASE_URL}/${env.WHATSAPP_API_VERSION}`;
  const authHeader = { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` };

  const existing = await axios.get(`${base}/${wabaId}/message_templates`, {
    headers: authHeader,
    params: { fields: "name,id", limit: 200 },
  });
  const existingByName = new Map<string, string>(
    (existing.data.data as { name: string; id: string }[]).map((t) => [t.name, t.id])
  );

  for (const template of TEMPLATE_DEFINITIONS) {
    const existingId = existingByName.get(template.name);
    const action = existingId ? "Editing" : "Creating";
    process.stdout.write(`${action} "${template.name}"... `);
    try {
      const response = existingId
        ? await axios.post(
            `${base}/${existingId}`,
            {
              category: template.category,
              parameter_format: template.parameter_format,
              components: template.components,
            },
            { headers: authHeader }
          )
        : await axios.post(`${base}/${wabaId}/message_templates`, template, {
            headers: authHeader,
          });
      const id = existingId ?? response.data.id;
      console.log(`OK (id: ${id}, status: ${response.data.status ?? "PENDING (re-review)"})`);
    } catch (err) {
      const detail = axios.isAxiosError(err)
        ? JSON.stringify(err.response?.data?.error ?? err.response?.data)
        : String(err);
      console.log(`FAILED — ${detail}`);
    }
  }

  console.log(
    "\nDone. New/edited templates go into PENDING review — check WhatsApp Manager > " +
      "Account tools > Message templates for approval status (usually minutes, " +
      "occasionally up to ~24h). Do not send a template until it shows APPROVED."
  );
}

main();
