import Anthropic from "@anthropic-ai/sdk";
import type { AnalysedReport, Findings } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";

const SYSTEM = `You are a senior cyber security consultant at Be Tech Secure, a UK managed security provider that makes enterprise-grade security affordable for SMEs.

You are writing a CUSTOMER-FACING external security review based only on PASSIVE, publicly available data. Your job is to turn raw findings into a clear, honest, consultative report for a business owner or IT manager.

Hard rules:
- Never invent data. Use only what is in the findings. If something is absent, say so or omit it.
- Port/software/CVE data comes from a third-party internet index and version banners. Treat associated vulnerabilities as INDICATIVE, never confirmed. Never tell the customer they "have" a vulnerability; say the detected version is "associated with" known issues that "would need validation".
- Tone: professional, friendly, consultative, practical. Never fear-based, never arrogant, never salesy. British English. Vary sentence length. Explain why things matter in business terms, not just technical terms.
- Lead with what is done well before what needs attention.
- Be specific and useful, but keep technical specifics proportionate for a customer audience.

Return ONLY valid JSON matching the requested schema. No markdown, no commentary.`;

function schemaPrompt(findings: Findings): string {
  return `Produce a JSON object with this exact shape:

{
  "executiveSummary": string,            // 4-6 sentences, plain English, positives first
  "summaryRows": [ { "area": string, "status": "green"|"amber"|"red"|"info", "observed": string } ],
  "observations": [ { "id": string, "title": string, "rag": "green"|"amber"|"red"|"info", "area": string, "body": string } ],
  "recommendations": [ { "priority": number, "recommendation": string, "effort": "Low"|"Low–Medium"|"Medium"|"Ongoing", "why": string } ],
  "caveats": [ string ]
}

Base everything strictly on these findings:

${JSON.stringify(findings, null, 2)}

Guidance:
- Email: comment on SPF (note if it softfails with ~all, if the lookup count is high, or if it authorises senders that look unused given the MX provider), DMARC (policy and pct — flag pct<100), DKIM (flag any key under 2048 bits), and missing MTA-STS/TLS-RPT.
- Hosts: highlight exposed database ports (e.g. 5432, 3306), management/monitoring ports (e.g. 9090, 8600), tags like "database" or "eol-product", older software versions in cpes, and any publicly reachable QA/staging hostnames. Group the message around "consistency of upkeep across a self-managed estate" rather than alarm.
- DNS hygiene: CAA absent, DNSSEC disabled, stale records.
- Always include a caveat that findings are external, indicative and a point-in-time snapshot.
- Keep observations to the genuinely noteworthy items (aim for 5-9).`;
}

/** Call Claude to turn raw findings into a structured, customer-facing report. */
export async function analyseFindings(findings: Findings): Promise<AnalysedReport> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM,
    messages: [{ role: "user", content: schemaPrompt(findings) }],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Analysis did not return JSON.");

  const parsed = JSON.parse(jsonMatch[0]) as Omit<AnalysedReport, "domain" | "generatedAt">;

  return {
    domain: findings.domain,
    generatedAt: new Date().toISOString(),
    ...parsed,
  };
}
