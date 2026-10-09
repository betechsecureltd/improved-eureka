import { promises as dns } from "node:dns";
import type { DnsFindings, EmailAuthFindings } from "../types";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

async function txt(name: string): Promise<string[]> {
  try {
    const rows = await dns.resolveTxt(name);
    return rows.map((chunks) => chunks.join(""));
  } catch {
    return [];
  }
}

// Count the DNS-lookup mechanisms in an SPF record, following includes one
// level deep. SPF's hard limit is 10 lookups; exceeding it breaks SPF.
async function countSpfLookups(record: string, depth = 0): Promise<number> {
  if (depth > 2) return 0;
  let count = 0;
  for (const part of record.split(/\s+/)) {
    const mech = part.toLowerCase();
    if (mech.startsWith("include:") || mech.startsWith("redirect=")) {
      count += 1;
      const target = part.split(/[:=]/)[1];
      const nested = (await txt(target)).find((t) => t.toLowerCase().startsWith("v=spf1"));
      if (nested) count += await countSpfLookups(nested, depth + 1);
    } else if (/^(a|mx|exists|ptr)(:|$)/.test(mech)) {
      count += 1;
    }
  }
  return count;
}

// Common DKIM selectors worth probing. Extend as needed per client.
const DKIM_SELECTORS = [
  "google", "default", "selector1", "selector2", "s1", "s2",
  "cm", "k1", "mail", "dkim", "mandrill", "mxvault",
];

function keyBitsFromDkim(record: string): number | null {
  const m = record.match(/p=([A-Za-z0-9+/=]+)/);
  if (!m || !m[1]) return null;
  try {
    const der = Buffer.from(m[1], "base64");
    // Rough estimate: subtract ~38 bytes of SubjectPublicKeyInfo/ASN.1 overhead,
    // the remainder is roughly the modulus. Good enough to flag 1024 vs 2048.
    const modulusBytes = der.length - 38;
    if (modulusBytes <= 0) return null;
    const bits = modulusBytes * 8;
    if (bits < 1300) return 1024;
    if (bits < 2600) return 2048;
    return 4096;
  } catch {
    return null;
  }
}

export async function collectEmailAuth(
  domain: string,
  dnsFindings: DnsFindings
): Promise<EmailAuthFindings> {
  const spf = dnsFindings.txt.find((t) => t.toLowerCase().startsWith("v=spf1")) ?? null;
  const spfIncludes = spf
    ? spf.split(/\s+/).filter((p) => p.toLowerCase().startsWith("include:")).map((p) => p.split(":")[1])
    : [];
  const spfSoftFail = spf ? /~all\s*$/.test(spf) : false;
  const spfLookupCount = spf ? await countSpfLookups(spf) : 0;

  const dmarcRecords = await txt(`_dmarc.${domain}`);
  const dmarc = dmarcRecords.find((t) => t.toLowerCase().startsWith("v=dmarc1")) ?? null;
  const dmarcPolicy = dmarc?.match(/\bp=([a-z]+)/i)?.[1]?.toLowerCase() ?? null;
  const pctMatch = dmarc?.match(/\bpct=(\d+)/i)?.[1];
  const dmarcPct = pctMatch ? Number(pctMatch) : dmarc ? 100 : null;
  const dmarcRua = dmarc
    ? (dmarc.match(/rua=([^;]+)/i)?.[1] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const dkimSelectors = await Promise.all(
    DKIM_SELECTORS.map(async (selector) => {
      const recs = await txt(`${selector}._domainkey.${domain}`);
      const rec = recs.find((r) => /k=rsa|p=/.test(r));
      return {
        selector,
        present: Boolean(rec),
        keyBits: rec ? keyBitsFromDkim(rec) : null,
      };
    })
  );

  const [mtaStsTxt, tlsRptTxt] = await Promise.all([
    txt(`_mta-sts.${domain}`),
    txt(`_smtp._tls.${domain}`),
  ]);

  return {
    spf,
    spfSoftFail,
    spfLookupCount,
    spfIncludes,
    dmarc,
    dmarcPolicy,
    dmarcPct,
    dmarcRua,
    dkimSelectors: dkimSelectors.filter((d) => d.present),
    mtaSts: mtaStsTxt.some((t) => t.toLowerCase().startsWith("v=stsv1")),
    tlsRpt: tlsRptTxt.some((t) => t.toLowerCase().startsWith("v=tlsrptv1")),
  };
}
