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

Use the "submit_report" tool to return the report. Fill every field.`;

// JSON Schema for the structured tool output — the model must return data in
// exactly this shape, so there is no fragile text-to-JSON parsing.
const REPORT_TOOL: Anthropic.Tool = {
  name: "submit_report",
  description: "Submit the finished customer-facing security review.",
  input_schema: {
    type: "object",
    properties: {
      executiveSummary: { type: "string", description: "4-6 sentences, plain English, positives first" },
      summaryRows: {
        type: "array",
        items: {
          type: "object",
          properties: {
            area: { type: "string" },
            status: { type: "string", enum: ["green", "amber", "red", "info"] },
            observed: { type: "string" },
          },
          required: ["area", "status", "observed"],
        },
      },
      observations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            rag: { type: "string", enum: ["green", "amber", "red", "info"] },
            area: { type: "string" },
            body: { type: "string" },
          },
          required: ["id", "title", "rag", "area", "body"],
        },
      },
      recommendations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            priority: { type: "number" },
            recommendation: { type: "string" },
            effort: { type: "string", enum: ["Low", "Low–Medium", "Medium", "Ongoing"] },
            why: { type: "string" },
          },
          required: ["priority", "recommendation", "effort", "why"],
        },
      },
      caveats: { type: "array", items: { type: "string" } },
    },
    required: ["executiveSummary", "summaryRows", "observations", "recommendations", "caveats"],
  },
};

function schemaPrompt(findings: Findings): string {
  return `Base everything strictly on these findings:

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
    max_tokens: 8192,
    system: SYSTEM,
    tools: [REPORT_TOOL],
    tool_choice: { type: "tool", name: "submit_report" },
    messages: [{ role: "user", content: schemaPrompt(findings) }],
  });

  const toolUse = msg.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "submit_report"
  );
  if (!toolUse) throw new Error("Analysis did not return a structured report.");

  const parsed = toolUse.input as Omit<AnalysedReport, "domain" | "generatedAt">;

  return {
    domain: findings.domain,
    generatedAt: new Date().toISOString(),
    ...parsed,
  };
}
