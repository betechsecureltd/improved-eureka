"use client";

import { useEffect, useState } from "react";

interface JobRow {
  id: string;
  domain: string;
  companyName: string | null;
  requesterName: string | null;
  requesterEmail: string;
  status: string;
  trigger: string;
  createdAt: string;
}

const STATUS_CLASS: Record<string, string> = {
  awaiting_approval: "amber",
  sent: "green",
  approved: "green",
  error: "red",
  rejected: "red",
};

function badgeClass(status: string): string {
  return STATUS_CLASS[status] ?? "grey";
}

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(k = key) {
    setError(null);
    const res = await fetch("/api/report", { headers: { "x-api-key": k } });
    if (res.ok) {
      setJobs(await res.json());
      setLoaded(true);
      sessionStorage.setItem("btsKey", k);
    } else {
      setError("Unauthorised — check the admin key.");
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("btsKey");
    if (saved) {
      setKey(saved);
      load(saved);
    }
  }, []);

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <h1>Report queue</h1>
          <p>Incoming requests from the website and manual runs. Review and approve before anything is sent.</p>
        </div>
        <a className="btn btn-primary" href="/admin/new">+ New report</a>
      </div>

      {!loaded && (
        <div className="card card-pad" style={{ display: "flex", gap: 10, maxWidth: 520 }}>
          <input
            className="input"
            type="password"
            placeholder="Admin API key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
          <button className="btn btn-primary" onClick={() => load()}>Unlock</button>
        </div>
      )}
      {error && <p style={{ color: "var(--red)" }}>{error}</p>}

      {loaded && (
        <div className="card">
          {jobs.length === 0 && <div className="empty">No reports yet. Start one with <a href="/admin/new">New report</a>.</div>}
          {jobs.map((j) => (
            <a key={j.id} href={`/admin/${j.id}`} className="rowcard" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="main">
                <div className="domain">{j.domain}</div>
                <div className="sub">
                  {j.companyName ? <strong>{j.companyName}</strong> : "—"}
                  {j.requesterName ? ` · ${j.requesterName}` : ""}
                  {` · ${j.requesterEmail}`}
                </div>
              </div>
              <span className="chip">{j.trigger}</span>
              <span className="sub" style={{ fontSize: 12 }}>{new Date(j.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              <span className={`badge ${badgeClass(j.status)}`}>{j.status.replace(/_/g, " ")}</span>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
