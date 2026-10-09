import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/store";
import { renderReportHtml } from "@/lib/report/template";
import { htmlToPdf } from "@/lib/report/pdf";
import { isAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET /api/report/:id/pdf — render the branded PDF (preview or download). */
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
  const pdf = await htmlToPdf(html);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="security-review-${job.domain}.pdf"`,
    },
  });
}
