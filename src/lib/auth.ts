// Lightweight session auth: a signed, httpOnly cookie you get by logging in
// once with the admin password. No per-action API key. Uses Web Crypto so it
// works in both the Node runtime (route handlers) and the Edge runtime
// (middleware).

export const SESSION_COOKIE = "bts_session";
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function secret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.ADMIN_API_KEY ||
    process.env.ADMIN_PASSWORD ||
    "insecure-dev-secret-change-me"
  );
}

/** The password that logs an admin in. */
export function adminPassword(): string | null {
  return process.env.ADMIN_PASSWORD || process.env.ADMIN_API_KEY || null;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Create a signed session token valid for ttlMs. */
export async function createSession(ttlMs = DEFAULT_TTL_MS): Promise<string> {
  const expiry = String(Date.now() + ttlMs);
  const sig = await hmac(expiry);
  return `${expiry}.${sig}`;
}

/** Verify a session token: correct signature and not expired. */
export async function verifySession(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [expiry, sig] = token.split(".");
  if (!expiry || !sig) return false;
  if (Number(expiry) < Date.now()) return false;
  const expected = await hmac(expiry);
  // constant-time-ish compare
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
