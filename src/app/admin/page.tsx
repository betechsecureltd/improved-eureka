"use client";

import { useEffect, useMemo, useState } from "react";

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
const badgeClass = (s: string) => STATUS_CLASS[s] ?? "grey";

export default function DashboardPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  async function load() {
    const res = await fetch("/api/report");
    if (res.ok) setJobs(await res.json());
    setLoaded(true);
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 8000); // keep the list fresh
    return () => clearInterval(t);
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = jobs.filter((j) => {
      const d = new Date(j.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return {
      total: jobs.length,
      thisMonth,
      awaiting: jobs.filter((j) => j.status === "awaiting_approval").length,
      sent: jobs.filter((j) => j.status === "sent" || j.status === "approved").length,
    };
  }, [jobs]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return jobs.filter((j) => {
      if (filter !== "all" && j.status !== filter) return false;
      if (!needle) return true;
      return [j.domain, j.companyName, j.requesterName, j.requesterEmail]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(needle));
    });
  }, [jobs, q, filter]);

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Every report you&apos;ve run, with status and history. Review and approve before anything is sent.</p>
        </div>
        <a className="btn btn-primary" href="/admin/new">+ New report</a>
      </div>

      <div className="stats">
        <div className="stat"><div className="n">{stats.total}</div><div className="l">Total reports</div></div>
        <div className="stat accent"><div className="n">{stats.thisMonth}</div><div className="l">This month</div></div>
        <div className="stat amber-n"><div className="n">{stats.awaiting}</div><div className="l">Awaiting approval</div></div>
        <div className="stat green-n"><div className="n">{stats.sent}</div><div className="l">Approved / sent</div></div>
      </div>

      <div className="toolbar">
        <input className="input" placeholder="Search domain, company or contact…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="awaiting_approval">Awaiting approval</option>
          <option value="sent">Sent</option>
          <option value="approved">Approved</option>
          <option value="collecting">Collecting</option>
          <option value="analysing">Analysing</option>
          <option value="rejected">Rejected</option>
          <option value="error">Error</option>
        </select>
      </div>

      <div className="card">
        {loaded && filtered.length === 0 && (
          <div className="empty">
            {jobs.length === 0 ? <>No reports yet. Start one with <a href="/admin/new">New report</a>.</> : "No reports match your search."}
          </div>
        )}
        {filtered.map((j) => (
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
            <span className="sub" style={{ fontSize: 12 }}>
              {new Date(j.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className={`badge ${badgeClass(j.status)}`}>{j.status.replace(/_/g, " ")}</span>
          </a>
        ))}
      </div>
    </main>
  );
}
