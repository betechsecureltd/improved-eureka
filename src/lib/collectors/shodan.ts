interface InternetDbResponse {
  ip: string;
  ports?: number[];
  cpes?: string[];
  hostnames?: string[];
  tags?: string[];
  vulns?: string[];
}

export interface ShodanHost {
  ip: string;
  ports: number[];
  cpes: string[];
  hostnames: string[];
  tags: string[];
  cves: string[];
}

/**
 * Look up an IP in Shodan's InternetDB — a free, no-key index of data Shodan
 * has ALREADY collected. This does not scan the target; it reads Shodan's
 * existing records. The `vulns` it returns are inferred from detected software
 * versions and are INDICATIVE only (see report caveats).
 *
 * If SHODAN_API_KEY is set, you can swap this for the full /shodan/host/{ip}
 * endpoint for richer, fresher data.
 */
export async function lookupHost(ip: string): Promise<ShodanHost | null> {
  try {
    const res = await fetch(`https://internetdb.shodan.io/${ip}`, {
      headers: { "User-Agent": "BTS-SecurityReporter/1.0" },
    });
    if (res.status === 404) {
      // Not indexed = nothing publicly observed. That's a valid, clean result.
      return { ip, ports: [], cpes: [], hostnames: [], tags: [], cves: [] };
    }
    if (!res.ok) return null;
    const data = (await res.json()) as InternetDbResponse;
    return {
      ip,
      ports: data.ports ?? [],
      cpes: data.cpes ?? [],
      hostnames: data.hostnames ?? [],
      tags: data.tags ?? [],
      cves: data.vulns ?? [],
    };
  } catch {
    return null;
  }
}

const PROVIDER_HINTS: [RegExp, string][] = [
  [/your-server\.de|hetzner/i, "Hetzner"],
  [/azure|cloudapp|azurewebsites|azurestaticapps/i, "Microsoft Azure"],
  [/amazonaws|aws/i, "Amazon AWS"],
  [/googleusercontent|1e100|google/i, "Google Cloud"],
  [/cloudflare/i, "Cloudflare"],
  [/digitalocean/i, "DigitalOcean"],
  [/ovh/i, "OVH"],
];

/** Best-effort hosting-provider label from reverse DNS / hostnames. */
export function inferProvider(hostnames: string[], ptr: string | null): string | null {
  const haystack = [...hostnames, ptr ?? ""].join(" ");
  for (const [re, name] of PROVIDER_HINTS) {
    if (re.test(haystack)) return name;
  }
  return null;
}
