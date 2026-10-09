"use client";

import { use, useEffect, useState } from "react";

interface ReportData {
  status: string;
  domain: string;
  error: string | null;
  requesterName: string | null;
  requesterEmail: string;
  companyName: string | null;
  contactPhone: string | null;
  notes: string | null;
  source: string | null;
  trigger: string;
  createdAt: string;
  report: {
    executiveSummary: string;
    summaryRows: { area: string; status: string; observed: string }[];
    observations: { id: string; title: string; rag: string; area: string; body: string }[];
    recommendations: { priority: number; recommendation: string; effort: string; why: string }[];
    caveats: string[];
  } | null;
}

const BADGE: Record<string, string> = { green: "green", amber: "amber", red: "red", info: "grey" };

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [key, setKey] = useState("");
  const [data, setData] = useState<ReportData | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setKey(sessionStorage.getItem("btsKey") ?? ""), []);

  async function load() {
    const res = await fetch(`/api/report/${id}`);
    if (res.ok) setData(await res.json());
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [id]);

  async function decide(decision: "approve" | "reject") {
    if (decision === "approve" && !confirm(`Send this report to ${data?.requesterEmail}?`)) return;
    setBusy(true);
    const res = await fetch(`/api/report/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify({ decision }),
    });
    setBusy(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      alert(`Failed: ${e.error ?? res.status}`);
    }
    load();
  }

  if (!data) return <main className="container"><p>Loading…</p></main>;

  const working = !data.report && data.status !== "error";

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <a href="/admin" style={{ fontSize: 14 }}>← Queue</a>
          <h1 style={{ marginTop: 6 }}>{data.domain}</h1>
          <p>
            <span className={`badge ${BADGE[statusColour(data.status)] ?? "grey"}`}>{data.status.replace(/_/g, " ")}</span>
          </p>
        </div>
      </div>

      {/* Captured intake details */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="detail-grid">
          <div><div className="k">Company</div><div className="v">{data.companyName ?? "—"}</div></div>
          <div><div className="k">Contact</div><div className="v">{data.requesterName ?? "—"}</div></div>
          <div><div className="k">Email (report sent to)</div><div className="v">{data.requesterEmail}</div></div>
          <div><div className="k">Phone</div><div className="v">{data.contactPhone ?? "—"}</div></div>
          <div><div className="k">Source</div><div className="v">{data.trigger}{data.source ? ` · ${data.source}` : ""}</div></div>
          <div><div className="k">Requested</div><div className="v">{new Date(data.createdAt).toLocaleString("en-GB")}</div></div>
          {data.notes && <div style={{ gridColumn: "1 / -1" }}><div className="k">Internal notes</div><div className="v" style={{ fontWeight: 400 }}>{data.notes}</div></div>}
        </div>
      </div>

      {data.error && <p style={{ color: "var(--red)" }}>Error: {data.error}</p>}
      {working && <div className="card card-pad"><p style={{ margin: 0 }}>Generating report… this page refreshes automatically.</p></div>}

      {data.report && (
        <>
          <div className="card card-pad" style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
            <a href={`/api/report/${id}/pdf`} target="_blank" className="btn btn-ghost">Preview PDF</a>
            <input className="input" style={{ width: 200 }} type="password" placeholder="Admin key" value={key} onChange={(e) => setKey(e.target.value)} />
            <button className="btn btn-success" disabled={busy || data.status === "sent"} onClick={() => decide("approve")}>
              {data.status === "sent" ? "Sent ✓" : "Approve & send"}
            </button>
            <button className="btn btn-danger" disabled={busy} onClick={() => decide("reject")}>Reject</button>
          </div>

          <div className="card card-pad">
            <h2 style={{ marginTop: 0 }}>Executive summary</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{data.report.executiveSummary}</p>

            <h2>Summary</h2>
            <table className="data-table" style={{ marginBottom: 20 }}>
              <thead><tr><th>Area</th><th>Status</th><th>Observed</th></tr></thead>
              <tbody>
                {data.report.summaryRows.map((r, i) => (
                  <tr key={i}><td>{r.area}</td><td><span className={`badge ${BADGE[r.status] ?? "grey"}`}>{r.status}</span></td><td>{r.observed}</td></tr>
                ))}
              </tbody>
            </table>

            <h2>Observations</h2>
            {data.report.observations.map((o) => (
              <div key={o.id} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className={`badge ${BADGE[o.rag] ?? "grey"}`}>{o.rag}</span>
                  <strong>{o.title}</strong>
                </div>
                <div className="k" style={{ margin: "2px 0 4px", textTransform: "uppercase", fontSize: 11 }}>{o.area}</div>
                <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{o.body}</p>
              </div>
            ))}

            <h2>Recommendations</h2>
            <ol>
              {data.report.recommendations.sort((a, b) => a.priority - b.priority).map((r, i) => (
                <li key={i} style={{ marginBottom: 6 }}><strong>{r.recommendation}</strong> ({r.effort}) — {r.why}</li>
              ))}
            </ol>

            <h2>Caveats</h2>
            <ul>{data.report.caveats.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>

          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            Review the wording, preview the PDF, then approve to send. (Inline editing before approval is a planned enhancement.)
          </p>
        </>
      )}
    </main>
  );
}

function statusColour(s: string): string {
  if (s === "awaiting_approval") return "amber";
  if (s === "sent" || s === "approved") return "green";
  if (s === "error" || s === "rejected") return "red";
  return "info";
}
