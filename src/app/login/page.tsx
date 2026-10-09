"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) {
      router.replace(next);
      router.refresh();
    } else {
      const e2 = await res.json().catch(() => ({}));
      setError(e2.error ?? "Login failed.");
    }
  }

  return (
    <main style={{ minHeight: "80vh", display: "grid", placeItems: "center" }}>
      <form className="card card-pad" onSubmit={submit} style={{ width: 360, maxWidth: "90vw" }}>
        <h1 style={{ marginTop: 0, fontSize: 20 }}>Sign in</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 4 }}>
          Enter the admin password to access the reporter.
        </p>
        <div className="field" style={{ marginTop: 14 }}>
          <label>Password</label>
          <input
            className="input"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p style={{ color: "var(--red)", fontSize: 14 }}>{error}</p>}
        <button className="btn btn-primary" style={{ width: "100%", marginTop: 16, justifyContent: "center" }} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
