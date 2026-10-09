import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getJob, saveJob } from "@/lib/store";
import { newJob, runReport } from "@/lib/pipeline";
import { isAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/report/:id/rerun
 * Clone an existing report's intake details into a fresh job and run it again.
 * Returns the new job id.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const { id } = await params;
  const prev = await getJob(id);
  if (!prev) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const job = newJob({
    domain: prev.domain,
    requesterEmail: prev.requesterEmail,
    requesterName: prev.requesterName,
    companyName: prev.companyName,
    contactPhone: prev.contactPhone,
    notes: prev.notes,
    source: "rerun",
    consent: prev.consent,
    trigger: "manual",
  });
  await saveJob(job);
  after(async () => {
    await runReport(job.id);
  });

  return NextResponse.json({ id: job.id, status: job.status }, { status: 202 });
}
