import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/store";
import { renderReportHtml } from "@/lib/report/template";
import { htmlToPdf } from "@/lib/report/pdf";

export const runtime = "nodejs";
export const maxDuration = 120;

/** GET /api/report/:id/pdf — render the branded PDF (preview or download). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
