"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewReportPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    company: "",
    name: "",
    email: "",
    phone: "",
    domain: "",
    notes: "",
    consent: false,
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.domain || !form.email) return setError("Domain and contact email are required.");
    if (!form.consent) return setError("Please confirm you're authorised to request this assessment.");

    setBusy(true);
    const res = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, trigger: "manual", source: "admin-manual" }),
    });
    setBusy(false);

    if (res.status === 202) {
      const { id } = await res.json();
      router.push(`/admin/${id}`);
    } else if (res.status === 401) {
      router.replace("/login?next=/admin/new");
    } else {
      const e2 = await res.json().catch(() => ({}));
      setError(e2.error ?? `Failed (${res.status})`);
    }
  }

  return (
    <main className="container" style={{ maxWidth: 760 }}>
      <div className="page-head">
        <div>
          <h1>New report</h1>
          <p>Run an assessment manually. These are the same fields the website forms submit.</p>
        </div>
      </div>

      <form className="card card-pad" onSubmit={submit}>
        <div className="form-grid">
          <div className="section-label">Who it's for</div>

          <div className="field">
            <label>Company name</label>
            <input className="input" value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Acme Ltd" />
            <span className="hint">Shown as &ldquo;Prepared for&rdquo; on the report.</span>
          </div>
          <div className="field">
            <label>Contact name</label>
            <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Jane Smith" />
          </div>
          <div className="field">
            <label>Contact email <span className="req">*</span></label>
            <input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="jane@acme.co.uk" />
            <span className="hint">The finished report is sent here.</span>
          </div>
          <div className="field">
            <label>Contact phone</label>
            <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="01234 567890" />
          </div>

          <div className="section-label">What to assess</div>
          <div className="field full">
            <label>Domain to test <span className="req">*</span></label>
            <input className="input" value={form.domain} onChange={(e) => set("domain", e.target.value.trim())} placeholder="example.co.uk" />
            <span className="hint">Just the domain — no https:// or paths.</span>
          </div>
          <div className="field full">
            <label>Internal notes</label>
            <textarea className="textarea" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Context for the analyst — how this lead came in, anything to watch for. Not shown to the client." />
          </div>

          <div className="consent">
            <input id="consent" type="checkbox" checked={form.consent} onChange={(e) => set("consent", e.target.checked)} />
            <label htmlFor="consent">
              I confirm we are authorised to run a passive external assessment of this domain, and that the report will be sent only to the contact above.
            </label>
          </div>
        </div>

        {error && <p style={{ color: "var(--red)", marginTop: 14 }}>{error}</p>}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Starting…" : "Run report"}</button>
          <a className="btn btn-ghost" href="/admin">Cancel</a>
        </div>
      </form>
    </main>
  );
}
