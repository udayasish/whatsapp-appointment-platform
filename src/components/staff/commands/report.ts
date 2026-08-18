import { and, eq } from "drizzle-orm";
import { db, reports, users } from "../../../lib/db/index.js";
import { enqueueReportDelivery } from "../../reports/queue/index.js";
import type { InboundMessageContext } from "../../whatsapp/services/message-router.js";

const REPORT_CAPTION_RE = /^REPORT\s+(\S+)$/i;

/** Triggered when staff attach a PDF with caption "REPORT <phone number>". */
export async function handleReportUpload(ctx: InboundMessageContext): Promise<string> {
  if (!ctx.mediaId) {
    return 'Please attach the PDF as a document with caption: REPORT <phone_number>';
  }

  const caption = (ctx.body ?? "").trim();
  const match = REPORT_CAPTION_RE.exec(caption);
  if (!match) {
    return 'Please attach the PDF with caption: REPORT <phone_number>';
  }

  const phone = match[1]!;
  const patient = await db.query.users.findFirst({
    where: and(eq(users.tenantId, ctx.tenant.id), eq(users.phoneNumber, phone)),
  });
  if (!patient) return `No patient found with phone number ${phone}.`;

  const [report] = await db
    .insert(reports)
    .values({
      tenantId: ctx.tenant.id,
      patientId: patient.id,
      fileUrl: ctx.mediaId,
      uploadedBy: ctx.user?.id,
    })
    .returning();

  await enqueueReportDelivery(report!.id);

  return `Report queued for delivery to ${phone}.`;
}
