"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

function statusColour(s: string): string {
  if (s === "awaiting_approval") return "amber";
  if (s === "sent" || s === "approved") return "green";
  if (s === "error" || s === "rejected") return "red";
  return "info";
}

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<ReportData | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/report/${id}`);
    if (res.ok) setData(await res.json());
  }
  useEffect(() => {
    load();
    const working = true;
    const t = setInterval(load, 4000);
    void working;
    return () => clearInterval(t);
  }, [id]);

  async function decide(decision: "approve" | "reject", send = false) {
    if (decision === "approve" && send && !confirm(`Email this report to ${data?.requesterEmail}?`)) return;
    setBusy(true);
    const res = await fetch(`/api/report/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, send }),
    });
    setBusy(false);
    const out = await res.json().catch(() => ({}));
    if (!res.ok) alert(`Failed: ${out.error ?? res.status}`);
    else if (out.note) alert(out.note);
    load();
  }

  async function rerun() {
    setBusy(true);
    const res = await fetch(`/api/report/${id}/rerun`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      const { id: newId } = await res.json();
      router.push(`/admin/${newId}`);
    } else {
      alert("Could not start a re-run.");
    }
  }

  if (!data) return <main className="container"><p>Loading…</p></main>;

  const working = !data.report && data.status !== "error";
  const decided = data.status === "sent" || data.status === "approved" || data.status === "rejected";

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <a href="/admin" style={{ fontSize: 14 }}>← Dashboard</a>
          <h1 style={{ marginTop: 6 }}>{data.domain}</h1>
          <p><span className={`badge ${BADGE[statusColour(data.status)] ?? "grey"}`}>{data.status.replace(/_/g, " ")}</span></p>
        </div>
        <button className="btn btn-ghost" onClick={rerun} disabled={busy}>↻ Run again</button>
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

      {data.error && (
        <div className="card card-pad" style={{ marginBottom: 16, borderColor: "var(--red)" }}>
          <strong style={{ color: "var(--red)" }}>Error:</strong> {data.error}
          <div style={{ marginTop: 10 }}><button className="btn btn-ghost" onClick={rerun} disabled={busy}>↻ Try again</button></div>
        </div>
      )}
      {working && <div className="card card-pad"><p style={{ margin: 0 }}>Generating report… this page refreshes automatically (usually 20–40 seconds).</p></div>}

      {data.report && (
        <>
          <div className="card card-pad" style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
            <a href={`/api/report/${id}/pdf`} target="_blank" className="btn btn-ghost">Open report → Save as PDF</a>
            {!decided && <button className="btn btn-success" disabled={busy} onClick={() => decide("approve", false)}>Approve</button>}
            {!decided && <button className="btn btn-primary" disabled={busy} onClick={() => decide("approve", true)}>Approve &amp; email</button>}
            {!decided && <button className="btn btn-danger" disabled={busy} onClick={() => decide("reject")}>Reject</button>}
            {data.status === "approved" && <span className="badge green">Approved ✓</span>}
            {data.status === "sent" && <span className="badge green">Emailed ✓</span>}
            {data.status === "rejected" && <span className="badge red">Rejected</span>}
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
        </>
      )}
    </main>
  );
}
