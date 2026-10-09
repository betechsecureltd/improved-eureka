// Shared types for the Be Tech Secure external security reporter.

export type Rag = "green" | "amber" | "red" | "info";

export interface DnsFindings {
  apex: string;
  a: string[];
  aaaa: string[];
  mx: string[];
  ns: string[];
  txt: string[];
  soa: string | null;
  dnssec: boolean;
  caa: string[];
}

export interface EmailAuthFindings {
  spf: string | null;
  spfSoftFail: boolean;        // true if record ends with ~all rather than -all
  spfLookupCount: number;      // DNS-lookup count (SPF limit is 10)
  spfIncludes: string[];
  dmarc: string | null;
  dmarcPolicy: string | null;  // none | quarantine | reject
  dmarcPct: number | null;     // percentage enforced
  dmarcRua: string[];          // aggregate report destinations
  dkimSelectors: { selector: string; keyBits: number | null; present: boolean }[];
  mtaSts: boolean;
  tlsRpt: boolean;
}

export interface HostExposure {
  ip: string;
  hostnames: string[];         // subdomains that resolve here
  ptr: string | null;
  provider: string | null;     // inferred hosting provider (Hetzner, Azure, etc.)
  ports: number[];
  cpes: string[];              // detected software (version-inferred)
  tags: string[];              // Shodan tags, e.g. "database", "eol-product"
  cveCount: number;            // count of version-associated CVEs (INDICATIVE only)
  cves: string[];
  source: "shodan-internetdb";
}

export interface CertFindings {
  subdomains: string[];
  issuers: string[];
  earliest: string | null;
  latest: string | null;
  note: string;                // e.g. free-tier window caveat
}

export interface Findings {
  domain: string;
  collectedAt: string;         // ISO timestamp
  dns: DnsFindings;
  email: EmailAuthFindings;
  certificates: CertFindings;
  hosts: HostExposure[];
  errors: string[];            // non-fatal collector errors, surfaced for transparency
}

// ---- Structured report produced by the analysis (Claude) step ----

export interface ReportObservation {
  id: string;
  title: string;
  rag: Rag;
  area: string;
  body: string;                // customer-facing, plain English
}

export interface ReportRecommendation {
  priority: number;
  recommendation: string;
  effort: "Low" | "Low–Medium" | "Medium" | "Ongoing";
  why: string;
}

export interface SummaryRow {
  area: string;
  status: Rag;
  observed: string;
}

export interface AnalysedReport {
  domain: string;
  generatedAt: string;
  executiveSummary: string;
  summaryRows: SummaryRow[];
  observations: ReportObservation[];
  recommendations: ReportRecommendation[];
  caveats: string[];
}

export type JobStatus =
  | "queued"
  | "collecting"
  | "analysing"
  | "rendering"
  | "awaiting_approval"
  | "approved"
  | "sent"
  | "rejected"
  | "error";

// Canonical intake. Both the website forms (via n8n) and the manual admin form
// post this same shape to POST /api/report. Every field except domain, email
// and consent is optional, so a short "free check" form and a fuller contact
// form can both feed the same endpoint.
export interface ReportIntake {
  domain: string;              // domain to assess
  email: string;              // contact + where the finished report is sent
  name?: string;              // contact name
  company?: string;           // organisation name (used as "Prepared for")
  phone?: string;             // contact phone (internal reference)
  notes?: string;             // internal notes from the requester/analyst
  consent: boolean;           // authorised-to-request confirmation
  trigger?: "form" | "manual";
  source?: string;            // which form/channel it came from (e.g. "homepage-check")
}

export interface ReportJob {
  id: string;
  domain: string;
  requesterEmail: string;      // where the finished report is sent
  requesterName?: string;
  companyName?: string;        // used as "Prepared for" on the report
  contactPhone?: string;
  notes?: string;
  source?: string;             // originating form/channel
  consent: boolean;            // authorised-to-request confirmation
  trigger: "form" | "manual";
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  findings?: Findings;
  report?: AnalysedReport;
  error?: string;
}
