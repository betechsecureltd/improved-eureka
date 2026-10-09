import type { CertFindings } from "../types";

interface CertSpotterIssuance {
  dns_names?: string[];
  not_before?: string;
  issuer?: { name?: string };
}

/**
 * Enumerate subdomains from Certificate Transparency logs via Cert Spotter.
 *
 * The free endpoint returns recent issuances only; a paid API key widens the
 * window. We treat the result as "much, but possibly not all" and say so in
 * the report caveats.
 */
export async function collectCertLogs(domain: string): Promise<CertFindings> {
  const url = new URL("https://api.certspotter.com/v1/issuances");
  url.searchParams.set("domain", domain);
  url.searchParams.set("include_subdomains", "true");
  url.searchParams.set("expand", "dns_names");
  url.searchParams.append("expand", "issuer");

  const headers: Record<string, string> = { "User-Agent": "BTS-SecurityReporter/1.0" };
  if (process.env.CERTSPOTTER_TOKEN) {
    headers.Authorization = `Bearer ${process.env.CERTSPOTTER_TOKEN}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Cert Spotter returned ${res.status}`);
  }
  const data = (await res.json()) as CertSpotterIssuance[];

  const names = new Set<string>();
  const issuers = new Set<string>();
  const dates: string[] = [];

  for (const issuance of data) {
    for (const name of issuance.dns_names ?? []) {
      const clean = name.toLowerCase().replace(/^\*\./, "");
      if (clean.endsWith(domain)) names.add(clean);
    }
    if (issuance.issuer?.name) issuers.add(issuance.issuer.name);
    if (issuance.not_before) dates.push(issuance.not_before);
  }
  dates.sort();

  return {
    subdomains: [...names].sort(),
    issuers: [...issuers],
    earliest: dates[0] ?? null,
    latest: dates[dates.length - 1] ?? null,
    note: process.env.CERTSPOTTER_TOKEN
      ? "Enumerated from Certificate Transparency logs (authenticated)."
      : "Enumerated from Certificate Transparency logs (free tier — recent certificates only; older subdomains may exist).",
  };
}
