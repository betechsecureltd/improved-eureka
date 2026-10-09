import type { Findings, HostExposure } from "./types";
import { collectDns, resolveHost, reverse } from "./collectors/dns";
import { collectEmailAuth } from "./collectors/emailauth";
import { collectCertLogs } from "./collectors/certlogs";
import { lookupHost, inferProvider } from "./collectors/shodan";

const MAX_HOSTS = Number(process.env.MAX_HOSTS ?? 40); // safety cap on fan-out

function validDomain(domain: string): boolean {
  return /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/i.test(domain) && domain.length <= 253;
}

/**
 * Run every passive collector for a domain and assemble a Findings object.
 * Collectors fail soft: a source that errors is recorded in `errors` and the
 * rest continue, so a flaky third party never kills the whole report.
 */
export async function collectFindings(domainInput: string): Promise<Findings> {
  const domain = domainInput.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!validDomain(domain)) {
    throw new Error(`"${domainInput}" is not a valid domain name.`);
  }

  const errors: string[] = [];

  const dns = await collectDns(domain);

  const [email, certificates] = await Promise.all([
    collectEmailAuth(domain, dns).catch((e) => {
      errors.push(`Email auth: ${e.message}`);
      return {
        spf: null, spfSoftFail: false, spfLookupCount: 0, spfIncludes: [],
        dmarc: null, dmarcPolicy: null, dmarcPct: null, dmarcRua: [],
        dkimSelectors: [], mtaSts: false, tlsRpt: false,
      };
    }),
    collectCertLogs(domain).catch((e) => {
      errors.push(`Certificate logs: ${e.message}`);
      return { subdomains: [], issuers: [], earliest: null, latest: null, note: "Certificate log lookup failed." };
    }),
  ]);

  // Map subdomains -> IPs (deduplicated), capped for safety.
  const candidates = [...new Set([domain, `www.${domain}`, ...certificates.subdomains])].slice(0, MAX_HOSTS);
  const ipToHosts = new Map<string, Set<string>>();

  await Promise.all(
    candidates.map(async (host) => {
      const ips = await resolveHost(host);
      for (const ip of ips) {
        if (!ipToHosts.has(ip)) ipToHosts.set(ip, new Set());
        ipToHosts.get(ip)!.add(host);
      }
    })
  );

  // Look up each distinct IP in Shodan's existing index.
  const hosts: HostExposure[] = await Promise.all(
    [...ipToHosts.entries()].map(async ([ip, hostSet]) => {
      const [shodan, ptr] = await Promise.all([lookupHost(ip), reverse(ip)]);
      const hostnames = [...hostSet].sort();
      return {
        ip,
        hostnames,
        ptr,
        provider: inferProvider([...hostnames, ...(shodan?.hostnames ?? [])], ptr),
        ports: shodan?.ports ?? [],
        cpes: shodan?.cpes ?? [],
        tags: shodan?.tags ?? [],
        cveCount: shodan?.cves.length ?? 0,
        cves: shodan?.cves ?? [],
        source: "shodan-internetdb" as const,
      };
    })
  );

  // Most-exposed hosts first.
  hosts.sort((a, b) => b.ports.length + b.cveCount - (a.ports.length + a.cveCount));

  return {
    domain,
    collectedAt: new Date().toISOString(),
    dns,
    email,
    certificates,
    hosts,
    errors,
  };
}
