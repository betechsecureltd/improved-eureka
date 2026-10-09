import { NextRequest, NextResponse } from "next/server";
import { getJob, saveJob } from "@/lib/store";
import { renderReportHtml } from "@/lib/report/template";
import { htmlToPdf } from "@/lib/report/pdf";
import { sendReportEmail } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorised(req: NextRequest): boolean {
  const key = req.headers.get("x-api-key");
  return Boolean(process.env.ADMIN_API_KEY) && key === process.env.ADMIN_API_KEY;
}

/**
 * POST /api/report/:id/approve
 * Human-in-the-loop gate. Approving renders the branded PDF and emails it to
 * the requester. Rejecting just marks the job rejected.
 * Body: { decision: "approve" | "reject", note?: string }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!authorised(req)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!job.report) return NextResponse.json({ error: "Report not ready" }, { status: 409 });

  const body = (await req.json().catch(() => ({}))) as { decision?: string };

  if (body.decision === "reject") {
    job.status = "rejected";
    await saveJob(job);
    return NextResponse.json({ status: job.status });
  }
  if (body.decision !== "approve") {
    return NextResponse.json({ error: "decision must be 'approve' or 'reject'" }, { status: 400 });
  }

  try {
    job.status = "rendering";
    await saveJob(job);

    const html = renderReportHtml(job.report, job.companyName ?? job.requesterName ?? "");
    const pdf = await htmlToPdf(html);

    const brand = process.env.BRAND_NAME ?? "Be Tech Secure";
    await sendReportEmail({
      to: job.requesterEmail,
      toName: job.requesterName,
      subject: `Your external security review — ${job.domain}`,
      pdf,
      pdfName: `security-review-${job.domain}.pdf`,
      bodyHtml: `<p>Hello${job.requesterName ? " " + escapeHtml(job.requesterName) : ""},</p>
<p>Thanks for requesting an external security review of <strong>${escapeHtml(job.domain)}</strong>. It's attached as a PDF.</p>
<p>It's based entirely on publicly available information — no scanning or testing of your systems was involved — and it highlights a few areas that may be worth attention, with practical next steps.</p>
<p>If anything would be useful to talk through, just reply to this email.</p>
<p>Best regards,<br>${escapeHtml(brand)}</p>`,
    });

    job.status = "sent";
    await saveJob(job);
    return NextResponse.json({ status: job.status });
  } catch (e) {
    job.status = "error";
    job.error = e instanceof Error ? e.message : String(e);
    await saveJob(job);
    return NextResponse.json({ error: job.error }, { status: 500 });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
