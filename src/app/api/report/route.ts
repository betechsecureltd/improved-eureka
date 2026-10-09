import { NextRequest, NextResponse } from "next/server";
import { newJob, runReport } from "@/lib/pipeline";
import { saveJob, listJobs } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 300; // allow long-running collection (Vercel Pro)

// Creating a job accepts EITHER the intake key (website form via n8n) or the
// admin key (manual form in the admin UI).
function canCreate(req: NextRequest): boolean {
  const key = req.headers.get("x-api-key");
  if (!key) return false;
  return (
    (Boolean(process.env.INTAKE_API_KEY) && key === process.env.INTAKE_API_KEY) ||
    (Boolean(process.env.ADMIN_API_KEY) && key === process.env.ADMIN_API_KEY)
  );
}

// Listing jobs is an admin action.
function isAdmin(req: NextRequest): boolean {
  const key = req.headers.get("x-api-key");
  return Boolean(process.env.ADMIN_API_KEY) && key === process.env.ADMIN_API_KEY;
}

/**
 * POST /api/report
 * Create a report job. Called by the website form via n8n, or manually.
 * Body: { domain, email, name?, consent:boolean, trigger?: "form"|"manual" }
 *
 * Protected by a shared secret (x-api-key) so only your n8n/admin can trigger it.
 */
export async function POST(req: NextRequest) {
  if (!canCreate(req)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const domain = String(body.domain ?? "").trim();
  const email = String(body.email ?? "").trim();
  const consent = body.consent === true;
  const trigger = body.trigger === "manual" ? "manual" : "form";

  if (!domain || !email) {
    return NextResponse.json({ error: "domain and email are required" }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "email is not valid" }, { status: 400 });
  }
  // Consent gate: we will not run a report without explicit authorisation.
  if (!consent) {
    return NextResponse.json(
      { error: "Authorisation to request this report (consent) is required." },
      { status: 400 }
    );
  }

  const job = newJob({
    domain,
    requesterEmail: email,
    requesterName: body.name ? String(body.name) : undefined,
    companyName: body.company ? String(body.company) : undefined,
    contactPhone: body.phone ? String(body.phone) : undefined,
    notes: body.notes ? String(body.notes) : undefined,
    source: body.source ? String(body.source) : undefined,
    consent,
    trigger,
  });
  await saveJob(job);

  // Kick off the pipeline in the background; return the job id immediately so
  // the caller can poll status without holding the request open.
  void runReport(job.id);

  return NextResponse.json({ id: job.id, status: job.status }, { status: 202 });
}

/** GET /api/report — list recent jobs (admin). */
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const jobs = await listJobs();
  return NextResponse.json(
    jobs.map((j) => ({
      id: j.id,
      domain: j.domain,
      companyName: j.companyName ?? null,
      requesterName: j.requesterName ?? null,
      requesterEmail: j.requesterEmail,
      status: j.status,
      trigger: j.trigger,
      createdAt: j.createdAt,
    }))
  );
}
