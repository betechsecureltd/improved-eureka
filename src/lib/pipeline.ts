import { collectFindings } from "./collect";
import { analyseFindings } from "./analyze";
import { getJob, saveJob } from "./store";
import type { ReportJob } from "./types";

/**
 * Run collect -> analyse and park the job at awaiting_approval.
 * Nothing is sent here: a human reviews and approves before delivery.
 * Called in the background after a job is created.
 */
export async function runReport(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;

  try {
    job.status = "collecting";
    await saveJob(job);
    const findings = await collectFindings(job.domain);

    job.findings = findings;
    job.status = "analysing";
    await saveJob(job);
    const report = await analyseFindings(findings);

    job.report = report;
    job.status = "awaiting_approval";
    await saveJob(job);
  } catch (e) {
    job.status = "error";
    job.error = e instanceof Error ? e.message : String(e);
    await saveJob(job);
  }
}

export function newJob(input: {
  domain: string;
  requesterEmail: string;
  requesterName?: string;
  companyName?: string;
  contactPhone?: string;
  notes?: string;
  source?: string;
  consent: boolean;
  trigger: "form" | "manual";
}): ReportJob {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    domain: input.domain.trim().toLowerCase(),
    requesterEmail: input.requesterEmail.trim(),
    requesterName: input.requesterName?.trim() || undefined,
    companyName: input.companyName?.trim() || undefined,
    contactPhone: input.contactPhone?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    source: input.source?.trim() || undefined,
    consent: input.consent,
    trigger: input.trigger,
    status: "queued",
    createdAt: now,
    updatedAt: now,
  };
}
