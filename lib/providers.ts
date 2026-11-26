/**
 * Server-side IP intelligence providers.
 *
 * Primary:   ipapi.co      (free, no key required)
 * Fallback:  ipwho.is      (free, no key required)
 * Enrichment: ipwho.is security/connection fields, RDAP (rdap.org),
 *             optional AbuseIPDB when ABUSEIPDB_API_KEY is configured,
 *             optional ipinfo.io hostname/org when IPINFO_TOKEN is configured.
 *
 * Every field that a provider does not supply stays null and is rendered
 * as "Not Available" in the UI. Nothing here invents data.
 */

import { classifyIp, continentName, reverseDnsName } from "./ip";

export interface IpIntel {
  ip: string;
  version: 4 | 6;
  ipType: string;
  isPublic: boolean;
  classificationNote: string | null;
  hostname: string | null;
  reverseDns: string | null;
  asn: string | null;
  asnOrg: string | null;
  org: string | null;
  isp: string | null;
  connectionType: string | null;
  country: string | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  district: string | null;
  postal: string | null;
  latitude: number | null;
  longitude: number | null;
  continent: string | null;
  timezone: string | null;
  utcOffset: string | null;
  accuracy: string | null;
  networkRange: string | null;
  hosting: boolean | null;
  datacenter: boolean | null;
  mobile: boolean | null;
  proxy: boolean | null;
  vpn: boolean | null;
  tor: boolean | null;
  abuseScore: number | null;
  abuseReports: number | null;
  threatSummary: string | null;
  provider: string;
  fetchedAt: string;
}

const NA = null;

function emptyIntel(ip: string, provider: string): IpIntel {
  const cls = classifyIp(ip);
  return {
    ip,
    version: cls?.version ?? 4,
    ipType: cls?.label ?? "Unknown",
    isPublic: cls?.isPublic ?? false,
    classificationNote: cls && !cls.isPublic ? cls.explanation : null,
    hostname: NA,
    reverseDns: NA,
    asn: NA,
    asnOrg: NA,
    org: NA,
    isp: NA,
    connectionType: NA,
    country: NA,
    countryCode: NA,
    region: NA,
    city: NA,
    district: NA,
    postal: NA,
    latitude: NA,
    longitude: NA,
    continent: NA,
    timezone: NA,
    utcOffset: NA,
    accuracy: NA,
    networkRange: NA,
    hosting: NA,
    datacenter: NA,
    mobile: NA,
    proxy: NA,
    vpn: NA,
    tor: NA,
    abuseScore: NA,
    abuseReports: NA,
    threatSummary: NA,
    provider,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "User-Agent": "IP-Intelligence/1.0 (+https://github.com/)",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Provider returned HTTP ${res.status}`);
  return res.json();
}

function parseAsn(raw: unknown): { asn: string | null; asnOrg: string | null } {
  if (typeof raw !== "string" || !raw.trim()) return { asn: null, asnOrg: null };
  const match = raw.trim().match(/^(AS\d+)\s*(.*)$/i);
  if (match) return { asn: match[1].toUpperCase(), asnOrg: match[2] || null };
  return { asn: null, asnOrg: raw.trim() };
}

async function fromIpapi(ip: string): Promise<IpIntel> {
  const data = await fetchJson(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
  if (data?.error) throw new Error(data.reason ?? "ipapi.co lookup failed");
  const intel = emptyIntel(ip, "ipapi.co");
  const { asn, asnOrg } = parseAsn(data.asn ? `${data.asn} ${data.org ?? ""}` : data.org);
  intel.asn = asn;
  intel.asnOrg = asnOrg;
  intel.org = data.org ?? null;
  intel.isp = data.org ?? null;
  intel.country = data.country_name ?? null;
  intel.countryCode = data.country_code ?? null;
  intel.region = data.region ?? null;
  intel.city = data.city ?? null;
  intel.postal = data.postal ?? null;
  intel.latitude = typeof data.latitude === "number" ? data.latitude : null;
  intel.longitude = typeof data.longitude === "number" ? data.longitude : null;
  intel.continent = continentName(data.continent_code);
  intel.timezone = data.timezone ?? null;
  intel.utcOffset = data.utc_offset
    ? `UTC${String(data.utc_offset).slice(0, 3)}:${String(data.utc_offset).slice(3)}`
    : null;
  intel.networkRange = data.network ?? null;
  return intel;
}

async function fromIpwho(ip: string): Promise<IpIntel> {
  const data = await fetchJson(`https://ipwho.is/${encodeURIComponent(ip)}`);
  if (data?.success === false) throw new Error(data.message ?? "ipwho.is lookup failed");
  const intel = emptyIntel(ip, "ipwho.is");
  intel.country = data.country ?? null;
  intel.countryCode = data.country_code ?? null;
  intel.region = data.region ?? null;
  intel.city = data.city ?? null;
  intel.postal = data.postal ?? null;
  intel.latitude = typeof data.latitude === "number" ? data.latitude : null;
  intel.longitude = typeof data.longitude === "number" ? data.longitude : null;
  intel.continent = data.continent ?? continentName(data.continent_code);
  intel.timezone = data.timezone?.id ?? null;
  intel.utcOffset = data.timezone?.utc ?? null;
  intel.isp = data.connection?.isp ?? null;
  intel.org = data.connection?.org ?? null;
  intel.asnOrg = data.connection?.org ?? null;
  intel.asn = data.connection?.asn ? `AS${data.connection.asn}` : null;
  intel.connectionType = data.connection?.type ?? null;
  intel.hostname = data.connection?.domain ?? null;
  if (data.security) {
    intel.proxy = typeof data.security.proxy === "boolean" ? data.security.proxy : null;
    intel.vpn = typeof data.security.vpn === "boolean" ? data.security.vpn : null;
    intel.tor = typeof data.security.tor === "boolean" ? data.security.tor : null;
    intel.hosting = typeof data.security.hosting === "boolean" ? data.security.hosting : null;
  }
  return intel;
}

const HOSTING_HINTS = [
  "amazon", "aws", "google cloud", "microsoft azure", "digitalocean", "ovh",
  "hetzner", "linode", "vultr", "oracle cloud", "alibaba", "cloudflare",
  "datacenter", "data center", "hosting", "server",
];

/** Merge ipwho.is enrichment (security/connection) into a primary result. */
async function enrich(intel: IpIntel): Promise<IpIntel> {
  // Reverse DNS (PTR) via Cloudflare DNS-over-HTTPS — a fixed provider host,
  // queried with the validated reverse-zone name, never a user-supplied URL.
  try {
    const ptrName = reverseDnsName(intel.ip);
    if (ptrName) {
      const ptr = await fetchJson(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(ptrName)}&type=PTR`,
        { headers: { Accept: "application/dns-json" } }
      );
      const answer = Array.isArray(ptr?.Answer) ? ptr.Answer.find((a: any) => a?.type === 12) : null;
      if (answer?.data) intel.reverseDns = String(answer.data).replace(/\.$/, "");
    }
  } catch {
    // PTR is enrichment only; absence stays Not Available.
  }

  try {
    const extra = await fromIpwho(intel.ip);
    intel.proxy = intel.proxy ?? extra.proxy;
    intel.vpn = intel.vpn ?? extra.vpn;
    intel.tor = intel.tor ?? extra.tor;
    intel.hosting = intel.hosting ?? extra.hosting;
    intel.connectionType = intel.connectionType ?? extra.connectionType;
    intel.continent = intel.continent ?? extra.continent;
    intel.hostname = intel.hostname ?? extra.hostname;
    if (intel.provider === "ipapi.co") intel.provider = "ipapi.co + ipwho.is";
  } catch {
    // Enrichment is optional; primary data remains valid.
  }

  // Hosting/datacenter heuristic — labelled as such in the UI via provider note.
  if (intel.hosting === null && intel.asnOrg) {
    const org = intel.asnOrg.toLowerCase();
    if (HOSTING_HINTS.some((h) => org.includes(h))) {
      intel.hosting = true;
      intel.datacenter = true;
    }
  }

  // Optional ipinfo.io enrichment (hostname / org) when a token is configured.
  const ipinfoToken = process.env.IPINFO_TOKEN;
  if (ipinfoToken) {
    try {
      const data = await fetchJson(
        `https://ipinfo.io/${encodeURIComponent(intel.ip)}/json?token=${encodeURIComponent(ipinfoToken)}`
      );
      intel.hostname = intel.hostname ?? data.hostname ?? null;
      if (!intel.asn) {
        const { asn, asnOrg } = parseAsn(data.org);
        intel.asn = asn;
        intel.asnOrg = intel.asnOrg ?? asnOrg;
      }
      intel.accuracy = intel.accuracy ?? null; // ipinfo free tier has no accuracy radius
    } catch {
      // Optional provider; ignore failures.
    }
  }

  // Optional AbuseIPDB threat intelligence when an API key is configured.
  const abuseKey = process.env.ABUSEIPDB_API_KEY;
  if (abuseKey) {
    try {
      const data = await fetchJson(
        `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(intel.ip)}&maxAgeInDays=90`,
        { headers: { Key: abuseKey } }
      );
      const d = data?.data;
      if (d) {
        intel.abuseScore = typeof d.abuseConfidenceScore === "number" ? d.abuseConfidenceScore : null;
        intel.abuseReports = typeof d.totalReports === "number" ? d.totalReports : null;
        intel.threatSummary =
          intel.abuseScore === null
            ? null
            : intel.abuseScore >= 75
              ? "High abuse confidence reported by AbuseIPDB contributors in the last 90 days."
              : intel.abuseScore >= 25
                ? "Some abuse reports recorded by AbuseIPDB contributors in the last 90 days."
                : intel.abuseScore > 0
                  ? "Low abuse confidence; few or weak reports in the last 90 days."
                  : "No abuse reports recorded by AbuseIPDB in the last 90 days.";
      }
    } catch {
      intel.threatSummary = null;
    }
  }

  return intel;
}

/* ------------------------------ cache ------------------------------ */

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; value: IpIntel }>();

export async function lookupIp(ip: string): Promise<IpIntel> {
  const cls = classifyIp(ip);
  if (!cls) throw new Error("Invalid IP address");

  // Private / reserved addresses never leave the server: no provider can
  // geolocate them, and probing them would be meaningless.
  if (!cls.isPublic) {
    return emptyIntel(ip, "Local classification (no external lookup)");
  }

  const cached = cache.get(ip);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  let intel: IpIntel;
  try {
    intel = await fromIpapi(ip);
  } catch {
    intel = await fromIpwho(ip); // fallback provider
  }
  intel = await enrich(intel);
  cache.set(ip, { at: Date.now(), value: intel });
  return intel;
}

/* --------------------------- rate limiting -------------------------- */

const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 60;
const buckets = new Map<string, number[]>();

export function rateLimited(clientKey: string): boolean {
  const now = Date.now();
  const hits = (buckets.get(clientKey) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  buckets.set(clientKey, hits);
  return hits.length > RATE_LIMIT;
}

export function clientKeyFrom(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}
