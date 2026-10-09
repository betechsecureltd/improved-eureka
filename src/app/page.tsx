export default function Home() {
  return (
    <main className="container" style={{ maxWidth: 640 }}>
      <div className="card card-pad">
        <h1 style={{ marginTop: 0, color: "var(--brand)" }}>Security Reporter</h1>
        <p>
          The internal engine that generates passive external security reports. Triggered by
          the website form (via n8n) or run manually, it produces a draft for human approval,
          then emails the branded PDF to the client once approved.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <a className="btn btn-primary" href="/admin">Open dashboard</a>
          <a className="btn btn-ghost" href="/admin/new">New report</a>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 16, marginBottom: 0 }}>
          All assessments are passive and based only on publicly available information.
        </p>
      </div>
    </main>
  );
}
