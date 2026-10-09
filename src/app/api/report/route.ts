import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { newJob, runReport } from "@/lib/pipeline";
import { saveJob, listJobs } from "@/lib/store";
import { canCreate, isAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";
// Max function duration. Vercel Hobby allows up to 60s; Pro up to 300s. On a
// persistent host (Railway) this cap is ignored. The background pipeline runs
// via after(), so it keeps executing after the 202 response until it finishes
// or this limit is hit.
export const maxDuration = 60;

/**
 * POST /api/report
 * Create a report job. Called by the website form via n8n, or manually.
 * Admin (browser session) or the intake key (n8n) may create jobs.
 */
export async function POST(req: NextRequest) {
  if (!(await canCreate(req))) {
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

  // Run the pipeline after the response is sent. after() keeps the serverless
  // function alive for this work on Vercel (and runs inline on a persistent
  // host), so the report still finishes once the caller has its job id.
  after(async () => {
    await runReport(job.id);
  });

  return NextResponse.json({ id: job.id, status: job.status }, { status: 202 });
}

/** GET /api/report — list recent jobs (admin). */
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const jobs = await listJobs(200);
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
