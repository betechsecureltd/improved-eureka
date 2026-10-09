import { NextRequest, NextResponse } from "next/server";
import { getJob, saveJob } from "@/lib/store";
import { renderReportHtml } from "@/lib/report/template";
import { htmlToPdf } from "@/lib/report/pdf";
import { sendReportEmail } from "@/lib/email";
import { isAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

function emailConfigured(): boolean {
  return Boolean(process.env.MS_TENANT_ID && process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET && process.env.MS_SENDER);
}

/**
 * POST /api/report/:id/approve
 * Human-in-the-loop gate.
 *   { decision: "reject" }         -> marks rejected
 *   { decision: "approve" }        -> approves; emails the PDF if email is
 *                                     configured, otherwise just marks approved
 *                                     (you download/send the PDF yourself)
 *   { decision: "approve", send:true } -> force the email send
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!job.report) return NextResponse.json({ error: "Report not ready" }, { status: 409 });

  const body = (await req.json().catch(() => ({}))) as { decision?: string; send?: boolean };

  if (body.decision === "reject") {
    job.status = "rejected";
    await saveJob(job);
    return NextResponse.json({ status: job.status });
  }
  if (body.decision !== "approve") {
    return NextResponse.json({ error: "decision must be 'approve' or 'reject'" }, { status: 400 });
  }

  // Approve. Only send email when it's both configured and wanted.
  const wantSend = body.send !== false && emailConfigured();

  if (!wantSend) {
    job.status = "approved";
    await saveJob(job);
    return NextResponse.json({
      status: job.status,
      emailed: false,
      note: emailConfigured() ? "Approved." : "Approved. Email isn't configured, so download the PDF and send it manually.",
    });
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
    return NextResponse.json({ status: job.status, emailed: true });
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
