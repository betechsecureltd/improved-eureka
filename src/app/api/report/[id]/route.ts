import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/store";
import { isAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";

/** GET /api/report/:id — job status + report JSON (for polling / admin UI). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: job.id,
    domain: job.domain,
    status: job.status,
    error: job.error ?? null,
    report: job.report ?? null,
    requesterName: job.requesterName ?? null,
    requesterEmail: job.requesterEmail,
    companyName: job.companyName ?? null,
    contactPhone: job.contactPhone ?? null,
    notes: job.notes ?? null,
    source: job.source ?? null,
    trigger: job.trigger,
    consent: job.consent,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
}
