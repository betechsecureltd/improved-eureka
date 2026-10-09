# Be Tech Secure — External Security Reporter

A Next.js app (deploys to Vercel) that generates **passive** external security
reports for prospects and clients, renders them into a **branded PDF**, holds
each one for **human approval**, and emails the approved report to the
requester from your own mailbox.

It is triggered two ways:

- **Automated** — a form on your website posts to an n8n workflow, which calls this app's API.
- **Manual** — you create a job yourself from the admin area (or any authenticated POST).

Both paths run the same engine and both stop at the approval step. **Nothing is
sent to anyone without a human clicking "Approve & send."**

---

## Important: this tool is passive-only by design

Every data source is public and read-only:

| Source | What it gives | Active? |
|---|---|---|
| Public DNS | A/MX/NS/TXT/SOA/CAA, DMARC/SPF/DKIM/MTA-STS | No |
| Certificate Transparency (Cert Spotter) | Subdomain enumeration | No |
| Shodan **InternetDB** | Open ports, detected software, tags, version-linked CVEs | No — reads Shodan's existing index, does **not** scan the target |

The app **never scans, probes, or logs into** a target. Active vulnerability
scanning and penetration testing are deliberately **out of scope** and should
remain a separate, manually contracted service performed only with signed
authorisation (Computer Misuse Act 1990).

Two safeguards are built in:

1. **Consent gate** — the API refuses any job where `consent !== true`. Your
   website form must include an "I am authorised to request this assessment for
   this domain" checkbox.
2. **Human approval** — reports are generated as drafts and only delivered after
   review.

> ⚠️ The CVE data from InternetDB is **inferred from software version banners**.
> The report (and the analysis prompt) treat these as *indicative*, never as
> confirmed vulnerabilities. Keep it that way — it protects your credibility.

---

## Architecture

```
Website form ──► n8n (webhook) ──► POST /api/report ──► collectors (DNS, CT, Shodan, email-auth)
                     │                   │                      │
                     │                   │                      ▼
                     │                   │               Claude API  (analysis + narrative)
                     │                   │                      │
                     │                   ▼                      ▼
                     │            job store (Vercel KV)   status: awaiting_approval
                     │                   │
          (poll status) ◄────────────────┘
                     │
                     ▼
         /admin/[id]  ── human reviews, previews PDF ──► POST /api/report/[id]/approve
                                                               │
                                                               ▼
                                                   render PDF → Microsoft Graph → client email
```

### Project layout

```
src/
  lib/
    collectors/
      dns.ts         # DNS records + per-host resolution + reverse DNS
      emailauth.ts   # SPF / DMARC / DKIM (key size) / MTA-STS / TLS-RPT
      certlogs.ts    # subdomain enumeration from Certificate Transparency
      shodan.ts      # Shodan InternetDB lookup + provider inference
    collect.ts       # orchestrates collectors into a Findings object
    analyze.ts       # Claude call → structured, customer-facing report JSON
    report/
      template.ts    # branded HTML report
      pdf.ts         # HTML → PDF (serverless + local)
    email.ts         # Microsoft Graph send (app-only)
    store.ts         # job persistence (Vercel KV, in-memory fallback)
    pipeline.ts      # run collect → analyse → awaiting_approval
    types.ts         # shared types
  app/
    page.tsx                         # landing
    admin/page.tsx                   # report queue
    admin/[id]/page.tsx              # review & approve
    api/report/route.ts              # POST create job / GET list
    api/report/[id]/route.ts         # GET status + report JSON
    api/report/[id]/pdf/route.ts     # GET branded PDF
    api/report/[id]/approve/route.ts # POST approve/reject → send
```

---

## Setup

### 1. Install and run locally

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
```

Local dev uses full `puppeteer` for PDF and an in-memory job store, so you can
try the whole flow without Vercel KV.

### 2. Configure the environment

See `.env.example`. The essentials:

- `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` — for the analysis step. Confirm the
  current model id in the Anthropic console and set it here.
- `INTAKE_API_KEY` — shared secret n8n sends to create jobs.
- `ADMIN_API_KEY` — shared secret for the admin UI and approval endpoint.
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` — **required in production** (see below).
- `MS_*` — Microsoft Graph app registration for sending email.
- `BRAND_*` — your logo URL, colours and contact details for the PDF.
- `CERTSPOTTER_TOKEN` — recommended; datacentre IPs are rate-limited without it.

### 3a. Deploy to Railway

Railway runs this as a normal Node server (not serverless), so there are no
function timeouts to worry about for PDF rendering.

1. In Railway, create a project **from your GitHub repo** (you've done this).
2. Add the **Redis** plugin (New → Database → Redis). It sets `REDIS_URL`
   automatically, which the app's job store uses.
3. Add the other environment variables (Variables tab) from `.env.example`:
   `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `INTAKE_API_KEY`, `ADMIN_API_KEY`,
   the `MS_*` Graph vars, and any `BRAND_*` overrides. Leave `KV_REST_API_*`
   blank — Redis is in use instead.
4. Deploy. The included `nixpacks.toml` installs system Chromium for the PDF
   step and skips puppeteer's own Chromium download; `pdf.ts` finds the system
   Chromium automatically.
5. Railway gives you a public URL — visit `/admin`, enter your `ADMIN_API_KEY`,
   and run a test report.

If PDF generation ever fails with a "could not find Chromium" error, set
`PUPPETEER_EXECUTABLE_PATH` in Railway's variables to the Chromium path (run
`which chromium` in the deploy logs/shell to find it).

### 3b. Deploy to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel.
3. Add a Redis store from the **Vercel Marketplace** (Upstash Redis — Vercel KV
   has been folded into this). The `store.ts` module talks to the KV-compatible
   REST API via `@vercel/kv`, which works against an Upstash Redis store; set
   `KV_REST_API_URL` / `KV_REST_API_TOKEN` from the integration. (If you prefer,
   swap `store.ts` to use `@upstash/redis` directly — it's a small change.)
4. Add all other env vars from `.env.example`.
5. Set the **Framework Preset to Next.js** (a `vercel.json` pins this, but
   confirm it in Project Settings → Build & Deployment if you hit a "No Output
   Directory named public" error — that error means it was set to a static
   preset).

**Works on the free Hobby plan.** Report generation runs after the response via
Next's `after()`, so it completes without holding the request open, and
`maxDuration` is set to 60s (the Hobby limit). A very large estate's report
could occasionally approach that limit; if report generation times out on big
domains, raise `maxDuration` to 300 and use the Pro plan. PDF rendering uses
the bundled serverless Chromium (`@sparticuz/chromium`) automatically on Vercel.

> **Why a shared store is required in production:** serverless functions are
> stateless. The create request and the later status/approve requests run in
> different invocations, so jobs must live in shared storage (Redis/KV). The
> in-memory fallback is for local dev only.

---

## API reference

All endpoints are under `/api/report`. Authentication is via the `x-api-key`
header.

### `POST /api/report`  (create a job) — needs `INTAKE_API_KEY`

```jsonc
// body
{
  "domain": "example.co.uk",
  "email": "requester@example.co.uk",   // where the report is sent
  "name": "Jane Smith",                  // optional
  "consent": true,                       // REQUIRED — authorised to request
  "trigger": "form"                      // "form" | "manual"
}
```

```jsonc
// 202 response
{ "id": "uuid", "status": "queued" }
```

Returns immediately; the pipeline runs in the background.

### `GET /api/report/:id`  (status + report JSON)

Used by the admin UI to poll. Returns `status`, `report` (once ready) and any `error`.

### `GET /api/report/:id/pdf`  (branded PDF)

Renders the current report to PDF for preview or download.

### `POST /api/report/:id/approve`  — needs `ADMIN_API_KEY`

```jsonc
{ "decision": "approve" }   // or "reject"
```

On approve: renders the PDF and emails it to the requester, then sets status `sent`.

### `GET /api/report`  (list recent jobs) — needs `INTAKE_API_KEY`

---

## n8n workflow (suggested)

1. **Webhook** node — receives the website form submission.
2. **Set / validate** — ensure `consent` is `true` and the email is present;
   reject otherwise.
3. **HTTP Request** — `POST {APP_URL}/api/report` with header
   `x-api-key: {INTAKE_API_KEY}` and the JSON body above. Store the returned `id`.
4. **Notify you** — Slack/Teams/email: "New report queued for {domain} — review
   at {APP_URL}/admin/{id}".

You then review and approve in the admin UI. (If you later want n8n to also
drive approval, it can poll `GET /api/report/:id` until `awaiting_approval` and
post to the approve endpoint — but a human still clicks approve.)

The approval step intentionally lives in the app, not n8n, so the reviewer sees
the rendered report and the audit trail in one place.

---

## Microsoft Graph email setup

1. In Entra ID (Azure AD), register an application.
2. Add the **application** permission `Mail.Send` and grant admin consent.
3. Create a client secret.
4. Set `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, and `MS_SENDER`
   (the mailbox the report is sent from, e.g. `reports@betechsecure.co.uk`).

Prefer to send from Google Workspace instead? Replace `src/lib/email.ts` with a
Gmail API or SMTP implementation; the rest of the app is unchanged.

---

## What's deliberately left as a next step

This is a solid, runnable foundation. Sensible follow-ups:

- **Inline editing of the draft** before approval (currently preview + approve/reject).
- **Shodan full host API** for richer data (`SHODAN_API_KEY` is wired for this).
- **Rate limiting / abuse protection** on the intake if the form is public.
- **Storing the generated PDF** in blob storage rather than re-rendering on send.
- **Audit log** of who approved what and when.

---

## Legal & ethical note

This tool gathers only publicly available information and performs no active
testing. Even so, use it responsibly: honour the consent gate, send reports only
to the requesting party, and keep active assessment work behind written
authorisation. The report's own wording is written to be honest about what
external data can and cannot prove — don't overstate findings.
