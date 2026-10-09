import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/store";
import { renderReportHtml } from "@/lib/report/template";
import { isAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";

/**
 * GET /api/report/:id/pdf — returns the branded report as a print-ready HTML
 * page. The viewer uses the browser's Print → Save as PDF (the template has
 * A4 print CSS), which is reliable on serverless and keeps full brand fidelity.
 * Server-side PDF rendering (headless Chromium) is reserved for the email
 * attachment path, which runs on a persistent host or Pro function.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const { id } = await params;
  const job = await getJob(id);
  if (!job || !job.report) {
    return NextResponse.json({ error: "Report not ready" }, { status: 404 });
  }

  const html = renderReportHtml(job.report, job.companyName ?? job.requesterName ?? "");
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
