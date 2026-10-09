import type { AnalysedReport, Rag } from "../types";
import { LOGO_SVG } from "./logo";

// ---- Brand tokens: Be Tech Secure identity (override via env) ----
const BRAND = {
  name: process.env.BRAND_NAME ?? "Be Tech Secure",
  primary: process.env.BRAND_PRIMARY ?? "#251A5C",   // indigo wordmark
  accent: process.env.BRAND_ACCENT ?? "#6D4AFF",     // violet
  ink: "#1a2733",
  muted: "#5b6b7a",
  logoUrl: process.env.BRAND_LOGO_URL ?? "",          // if set, used instead of inline SVG
  website: process.env.BRAND_WEBSITE ?? "www.betechsecure.co.uk",
  websiteUrl: process.env.BRAND_WEBSITE_URL ?? "https://www.betechsecure.co.uk",
  email: process.env.BRAND_EMAIL ?? "",               // set when you have a shared inbox
  phone: process.env.BRAND_PHONE ?? "01483 668400",
  address: process.env.BRAND_ADDRESS ?? "2nd Floor Export House, 5 Henry Plaza, Victoria Way, Woking, GU21 6QX",
  // Where the "book a consultant" CTA points (e.g. a Calendly link).
  ctaUrl: process.env.BRAND_CTA_URL ?? "https://www.betechsecure.co.uk",
  ctaLabel: process.env.BRAND_CTA_LABEL ?? "Schedule a call with a security consultant",
};

const RAG_META: Record<Rag, { label: string; colour: string; dot: string }> = {
  green: { label: "Good", colour: "#1b7f4b", dot: "🟢" },
  amber: { label: "Worth attention", colour: "#b7791f", dot: "🟡" },
  red: { label: "Priority", colour: "#c0392b", dot: "🔴" },
  info: { label: "Informational", colour: "#5b6b7a", dot: "⚪" },
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function para(s: string): string {
  return esc(s)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function renderReportHtml(report: AnalysedReport, clientName: string): string {
  const date = new Date(report.generatedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const summaryRows = report.summaryRows
    .map(
      (r) => `<tr>
        <td>${esc(r.area)}</td>
        <td><span class="pill" style="color:${RAG_META[r.status].colour}">${RAG_META[r.status].dot} ${RAG_META[r.status].label}</span></td>
        <td>${esc(r.observed)}</td>
      </tr>`
    )
    .join("");

  const observations = report.observations
    .map(
      (o) => `<div class="obs">
        <h3><span class="dot">${RAG_META[o.rag].dot}</span> ${esc(o.title)}</h3>
        <div class="area">${esc(o.area)}</div>
        ${para(o.body)}
      </div>`
    )
    .join("");

  const recs = report.recommendations
    .sort((a, b) => a.priority - b.priority)
    .map(
      (r) => `<tr>
        <td class="num">${r.priority}</td>
        <td>${esc(r.recommendation)}</td>
        <td>${esc(r.effort)}</td>
        <td>${esc(r.why)}</td>
      </tr>`
    )
    .join("");

  const caveats = report.caveats.map((c) => `<li>${esc(c)}</li>`).join("");

  const logo = BRAND.logoUrl
    ? `<img class="logo" src="${BRAND.logoUrl}" alt="${esc(BRAND.name)}">`
    : `<div class="logo">${LOGO_SVG}</div>`;

  const contactBits = [
    BRAND.address ? esc(BRAND.address) : "",
    BRAND.phone ? `Tel: ${esc(BRAND.phone)}` : "",
    BRAND.email ? `Email: ${esc(BRAND.email)}` : "",
    BRAND.website ? `Web: <a href="${BRAND.websiteUrl}">${esc(BRAND.website)}</a>` : "",
  ].filter(Boolean).join(" &nbsp;·&nbsp; ");

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>External Security Review — ${esc(report.domain)}</title>
<style>
  @page { size: A4; margin: 16mm 15mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: ${BRAND.ink}; font-size: 11pt; line-height: 1.5; margin: 0; }
  .cover { border-top: 6px solid ${BRAND.primary}; padding-top: 22px; margin-bottom: 26px; }
  .logo { height: 46px; margin-bottom: 20px; }
  .logo svg { height: 46px; width: auto; }
  h1 { font-size: 25pt; margin: 0 0 4px; color: ${BRAND.primary}; }
  .sub { color: ${BRAND.muted}; font-size: 13pt; margin-bottom: 20px; }
  .meta { border-collapse: collapse; width: 100%; margin-bottom: 8px; }
  .meta td { padding: 4px 0; vertical-align: top; }
  .meta td:first-child { color: ${BRAND.muted}; width: 140px; font-size: 10pt; }
  h2 { font-size: 15pt; color: ${BRAND.primary}; margin: 26px 0 8px; border-bottom: 1px solid #e3e8ee; padding-bottom: 4px; }
  h3 { font-size: 12pt; margin: 16px 0 2px; }
  .area { color: ${BRAND.muted}; font-size: 9pt; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
  p { margin: 6px 0; }
  a { color: ${BRAND.accent}; }
  table.data { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 10pt; }
  table.data th { text-align: left; background: #f3f1fb; padding: 7px 9px; border-bottom: 2px solid #e3e8ee; }
  table.data td { padding: 7px 9px; border-bottom: 1px solid #eef2f6; vertical-align: top; }
  .num { font-weight: 700; color: ${BRAND.accent}; text-align: center; width: 36px; }
  .pill { font-weight: 600; white-space: nowrap; }
  .obs { margin-bottom: 4px; }
  .dot { font-size: 10pt; }
  /* Sales / CTA */
  .help { margin-top: 28px; background: linear-gradient(135deg, ${BRAND.primary}, #332568); color: #fff; border-radius: 12px; padding: 24px 26px; page-break-inside: avoid; }
  .help h2 { color: #fff; border: 0; margin: 0 0 6px; }
  .help p { color: #e7e3f7; margin: 6px 0 14px; }
  .help ul { margin: 0 0 18px; padding-left: 0; list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; }
  .help li { color: #efedfa; font-size: 10.5pt; padding-left: 20px; position: relative; }
  .help li::before { content: "✓"; position: absolute; left: 0; color: ${BRAND.accent}; font-weight: 700; }
  .cta { display: inline-block; background: ${BRAND.accent}; color: #fff !important; text-decoration: none; font-weight: 700; padding: 12px 22px; border-radius: 8px; font-size: 11.5pt; }
  .cta-note { color: #cfc8ee; font-size: 9pt; margin-top: 10px; }
  .footer { margin-top: 26px; padding-top: 12px; border-top: 2px solid ${BRAND.primary}; color: ${BRAND.muted}; font-size: 9pt; }
  .footer .name { color: ${BRAND.primary}; font-weight: 700; font-size: 10.5pt; }
  .disclaimer { font-style: italic; color: ${BRAND.muted}; font-size: 8.5pt; margin-top: 10px; }
</style>
</head>
<body>
  <div class="cover">
    ${logo}
    <h1>External Security Review</h1>
    <div class="sub">A courtesy assessment of publicly visible security posture</div>
    <table class="meta">
      <tr><td>Prepared for</td><td>${esc(clientName || "—")}</td></tr>
      <tr><td>Subject</td><td>${esc(report.domain)} and associated internet-facing systems</td></tr>
      <tr><td>Prepared by</td><td>${esc(BRAND.name)}</td></tr>
      <tr><td>Date</td><td>${date}</td></tr>
      <tr><td>Classification</td><td>Confidential — for the named recipient only</td></tr>
    </table>
  </div>

  <h2>Executive summary</h2>
  ${para(report.executiveSummary)}

  <h2>Summary of observations</h2>
  <table class="data">
    <thead><tr><th>Area</th><th>Status</th><th>What we observed</th></tr></thead>
    <tbody>${summaryRows}</tbody>
  </table>

  <h2>Detailed observations</h2>
  ${observations}

  <h2>Prioritised recommendations</h2>
  <table class="data">
    <thead><tr><th>#</th><th>Recommendation</th><th>Effort</th><th>Why it matters</th></tr></thead>
    <tbody>${recs}</tbody>
  </table>

  <h2>Important caveats</h2>
  <ul>${caveats}</ul>

  <div class="help">
    <h2>How ${esc(BRAND.name)} can help</h2>
    <p>Most of what this review raises comes down to one thing: keeping a growing estate consistently patched, monitored and tidy. That's hard to do around a busy day job — and it's exactly where we help. We make enterprise-grade security practical and affordable for organisations your size, so protection runs in the background rather than landing on someone's to-do list.</p>
    <ul>
      <li>Validate these findings with an authorised assessment</li>
      <li>Managed patching across your servers</li>
      <li>Ongoing vulnerability scanning &amp; monitoring</li>
      <li>Email &amp; Microsoft 365 / Google Workspace hardening</li>
      <li>Managed Detection &amp; Response (MDR)</li>
      <li>Cyber Essentials &amp; security awareness training</li>
    </ul>
    <a class="cta" href="${BRAND.ctaUrl}">${esc(BRAND.ctaLabel)} →</a>
    <div class="cta-note">No obligation — a 20-minute call to talk through what, if anything, is worth acting on.</div>
  </div>

  <div class="footer">
    <div class="name">${esc(BRAND.name)}</div>
    ${contactBits}
    <div class="disclaimer">This review is based on publicly available data and is provided in good faith as a courtesy. No active scanning, probing or login attempts were made. It does not constitute a guarantee of security or a substitute for a full, authorised assessment.</div>
  </div>
</body>
</html>`;
}
