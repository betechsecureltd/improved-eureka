import { promises as dns } from "node:dns";
import type { DnsFindings } from "../types";

// Use a public resolver explicitly so results are consistent regardless of
// the Vercel function's default resolver.
dns.setServers(["1.1.1.1", "8.8.8.8"]);

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function collectDns(domain: string): Promise<DnsFindings> {
  const [a, aaaa, mxRecords, ns, txtRaw, soa, caaRaw, dsRaw] = await Promise.all([
    safe(() => dns.resolve4(domain), [] as string[]),
    safe(() => dns.resolve6(domain), [] as string[]),
    safe(() => dns.resolveMx(domain), [] as { exchange: string; priority: number }[]),
    safe(() => dns.resolveNs(domain), [] as string[]),
    safe(() => dns.resolveTxt(domain), [] as string[][]),
    safe(async () => {
      const s = await dns.resolveSoa(domain);
      return `${s.nsname} ${s.hostmaster} serial=${s.serial}`;
    }, null as string | null),
    safe(() => dns.resolveCaa(domain), [] as import("node:dns").CaaRecord[]),
    // DS records at the parent indicate a DNSSEC chain of trust.
    safe(() => dns.resolveAny(`${domain}`), [] as unknown[]),
  ]);

  const txt = txtRaw.map((chunks) => chunks.join(""));
  const caa = caaRaw
    .map((r) => (r.issue ? `issue ${r.issue}` : r.issuewild ? `issuewild ${r.issuewild}` : r.iodef ? `iodef ${r.iodef}` : ""))
    .filter(Boolean);

  // Best-effort DNSSEC signal: a DNSKEY lookup that succeeds implies signing.
  const dnssec = await safe(async () => {
    const rec = await dns.resolve(domain, "DNSKEY" as never);
    return Array.isArray(rec) && rec.length > 0;
  }, false);

  void dsRaw; // reserved for future parent-DS inspection

  return {
    apex: domain,
    a,
    aaaa,
    mx: mxRecords
      .sort((x, y) => x.priority - y.priority)
      .map((m) => `${m.priority} ${m.exchange}`),
    ns,
    txt,
    soa,
    dnssec,
    caa,
  };
}

/** Resolve a single hostname to its A records (used for subdomain mapping). */
export async function resolveHost(host: string): Promise<string[]> {
  return safe(() => dns.resolve4(host), [] as string[]);
}

/** Reverse-DNS a single IP. */
export async function reverse(ip: string): Promise<string | null> {
  return safe(async () => {
    const names = await dns.reverse(ip);
    return names[0] ?? null;
  }, null);
}
