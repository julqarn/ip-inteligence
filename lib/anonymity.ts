/**
 * VPN, Proxy & Anonymity Detection Engine (server-side only).
 *
 * Every classification is derived from named signals with sources:
 *  - ipwho.is security indicators (via the normalized IpIntel report)
 *  - Tor Project bulk exit list (authoritative for Tor exit status)
 *  - ASN / organization / hostname ownership analysis (clearly labelled
 *    as inference, never presented as database confirmation)
 *  - Optional key-based providers: ipinfo privacy, IPQualityScore,
 *    IP2Location, Abstract IP Intelligence. The engine remains fully
 *    functional without any paid credentials.
 *
 * A hosting/datacenter IP is NEVER classified as a VPN on that basis
 * alone. When sources disagree, the result is Inconclusive and the
 * disagreement is reported instead of hidden.
 */

import type { IpIntel } from "./providers";

export type DetectionStatus =
  | "Detected"
  | "Not Detected"
  | "Likely"
  | "Unknown"
  | "Inconclusive";
export type Confidence = "High" | "Medium" | "Low" | "Unknown";

export interface Signal {
  category: string;
  name: string;
  source: string;
  value: boolean | null;
  evidence: string;
  /** Inference signals (ownership heuristics) never confirm a category alone. */
  inference?: boolean;
}

export interface CategoryResult {
  id: string;
  label: string;
  status: DetectionStatus;
  confidence: Confidence;
  explanation: string;
  sources: string[];
  lastUpdated: string;
}

export interface AnonymityReport {
  ip: string;
  version: 4 | 6;
  ipType: string;
  isPublic: boolean;
  country: string | null;
  countryCode: string | null;
  isp: string | null;
  asn: string | null;
  asnOrg: string | null;
  networkType: string;
  vpn: CategoryResult;
  vpnProvider: string | null;
  proxy: CategoryResult;
  proxySubtypes: Record<string, CategoryResult>;
  tor: CategoryResult;
  hosting: CategoryResult;
  hostingProvider: string | null;
  datacenter: CategoryResult;
  residential: CategoryResult;
  mobile: CategoryResult;
  corporate: CategoryResult;
  classificationConfidence: Confidence;
  reputationRisk: {
    level: "High" | "Medium" | "Low" | "Unknown";
    score: number | null;
    explanation: string;
    sources: string[];
  };
  signals: Signal[];
  disagreements: string[];
  summary: string;
  sourcesUsed: string[];
  unavailableSources: string[];
  fetchedAt: string;
}

const now = () => new Date().toISOString();

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", "User-Agent": "IP-Intelligence/1.0", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ------------------------- Tor exit list ------------------------- */

let torCache: { at: number; set: Set<string> } | null = null;
const TOR_TTL_MS = 60 * 60 * 1000;

async function torExitSet(): Promise<Set<string> | null> {
  if (torCache && Date.now() - torCache.at < TOR_TTL_MS) return torCache.set;
  try {
    const res = await fetch("https://check.torproject.org/torbulkexitlist", {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!res.ok) return torCache?.set ?? null;
    const text = await res.text();
    const set = new Set(text.split(/\s+/).map((s) => s.trim()).filter(Boolean));
    torCache = { at: Date.now(), set };
    return set;
  } catch {
    return torCache?.set ?? null;
  }
}

/* --------------------- ownership identification --------------------- */

const VPN_PROVIDERS: [string, string[]][] = [
  ["NordVPN", ["nordvpn", "nord security", "tefincom"]],
  ["ExpressVPN", ["expressvpn", "express vpn"]],
  ["Surfshark", ["surfshark"]],
  ["Proton VPN", ["protonvpn", "proton vpn", "proton technologies", "proton ag"]],
  ["Mullvad", ["mullvad", "31173 services"]],
  ["CyberGhost", ["cyberghost"]],
  ["Private Internet Access", ["private internet access", "london trust media"]],
  ["Windscribe", ["windscribe"]],
  ["IVPN", ["ivpn"]],
];

const HOSTING_PROVIDERS: [string, string[]][] = [
  ["Amazon AWS", ["amazon", "aws"]],
  ["Google Cloud", ["google cloud", "google llc", "google inc"]],
  ["Microsoft Azure", ["microsoft azure", "microsoft corporation"]],
  ["DigitalOcean", ["digitalocean"]],
  ["OVHcloud", ["ovh"]],
  ["Hetzner", ["hetzner"]],
  ["Vultr", ["vultr", "constant company"]],
  ["Oracle Cloud", ["oracle"]],
  ["Cloudflare", ["cloudflare"]],
  ["Linode / Akamai", ["linode", "akamai"]],
  ["Alibaba Cloud", ["alibaba"]],
  ["M247 (VPN infrastructure)", ["m247"]],
  ["Datacamp (VPN infrastructure)", ["datacamp"]],
];

function ownershipText(intel: IpIntel): string {
  return [intel.org, intel.asnOrg, intel.isp, intel.hostname, intel.reverseDns]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchProvider(text: string, table: [string, string[]][]): string | null {
  for (const [name, hints] of table) {
    if (hints.some((h) => text.includes(h))) return name;
  }
  return null;
}

/* --------------------- optional provider signals --------------------- */

interface OptionalSignals {
  signals: Signal[];
  proxySubtypes: Record<string, { value: boolean | null; source: string }>;
  fraudScore: number | null;
  usageType: string | null;
  used: string[];
  unavailable: string[];
}

async function optionalSignals(ip: string): Promise<OptionalSignals> {
  const out: OptionalSignals = {
    signals: [],
    proxySubtypes: {},
    fraudScore: null,
    usageType: null,
    used: [],
    unavailable: [],
  };
  const jobs: Promise<void>[] = [];

  const ipinfoToken = process.env.IPINFO_TOKEN;
  if (ipinfoToken) {
    jobs.push(
      (async () => {
        try {
          const d = await fetchJson(
            `https://ipinfo.io/${encodeURIComponent(ip)}/privacy?token=${encodeURIComponent(ipinfoToken)}`
          );
          out.used.push("ipinfo.io privacy");
          for (const [cat, key] of [["vpn", "vpn"], ["proxy", "proxy"], ["tor", "tor"], ["hosting", "hosting"]] as const) {
            if (typeof d?.[key] === "boolean")
              out.signals.push({ category: cat, name: `ipinfo ${key}`, source: "ipinfo.io", value: d[key], evidence: `ipinfo privacy reports ${key}=${d[key]}` });
          }
        } catch {
          out.unavailable.push("ipinfo.io privacy (request failed or plan does not include privacy data)");
        }
      })()
    );
  }

  const ipqsKey = process.env.IPQUALITYSCORE_API_KEY;
  if (ipqsKey) {
    jobs.push(
      (async () => {
        try {
          const d = await fetchJson(
            `https://ipqualityscore.com/api/json/ip/${encodeURIComponent(ipqsKey)}/${encodeURIComponent(ip)}?strictness=1`
          );
          out.used.push("IPQualityScore");
          const map: [string, string][] = [["vpn", "vpn"], ["vpn", "active_vpn"], ["proxy", "proxy"], ["tor", "tor"], ["tor", "active_tor"], ["hosting", "hosting"], ["mobile", "mobile"]];
          for (const [cat, key] of map) {
            if (typeof d?.[key] === "boolean")
              out.signals.push({ category: cat, name: `IPQS ${key}`, source: "IPQualityScore", value: d[key], evidence: `IPQualityScore reports ${key}=${d[key]}` });
          }
          if (typeof d?.fraud_score === "number") out.fraudScore = d.fraud_score;
          if (typeof d?.connection_type === "string") out.usageType = d.connection_type;
        } catch {
          out.unavailable.push("IPQualityScore (request failed or rate-limited)");
        }
      })()
    );
  }

  const ip2Key = process.env.IP2LOCATION_API_KEY;
  if (ip2Key) {
    jobs.push(
      (async () => {
        try {
          const d = await fetchJson(
            `https://api.ip2location.io/?key=${encodeURIComponent(ip2Key)}&ip=${encodeURIComponent(ip)}`
          );
          out.used.push("IP2Location");
          if (typeof d?.is_proxy === "boolean")
            out.signals.push({ category: "proxy", name: "IP2Location is_proxy", source: "IP2Location", value: d.is_proxy, evidence: `IP2Location reports is_proxy=${d.is_proxy}` });
          const ptype = typeof d?.proxy_type === "string" ? d.proxy_type.toUpperCase() : null;
          if (ptype && ptype !== "-") {
            if (ptype === "VPN") out.signals.push({ category: "vpn", name: "IP2Location proxy_type", source: "IP2Location", value: true, evidence: "IP2Location proxy_type=VPN" });
            if (ptype === "TOR") out.signals.push({ category: "tor", name: "IP2Location proxy_type", source: "IP2Location", value: true, evidence: "IP2Location proxy_type=TOR" });
            if (ptype === "WEB") out.proxySubtypes.http = { value: true, source: "IP2Location proxy_type=WEB" };
            if (ptype === "PUB") out.proxySubtypes.anonymous = { value: true, source: "IP2Location proxy_type=PUB (public proxy)" };
            if (ptype === "DCH") out.signals.push({ category: "hosting", name: "IP2Location proxy_type", source: "IP2Location", value: true, evidence: "IP2Location proxy_type=DCH (datacenter)" });
          }
          if (typeof d?.usage_type === "string") out.usageType = d.usage_type;
        } catch {
          out.unavailable.push("IP2Location (request failed or rate-limited)");
        }
      })()
    );
  }

  const abstractKey = process.env.ABSTRACT_API_KEY;
  if (abstractKey) {
    jobs.push(
      (async () => {
        try {
          const d = await fetchJson(
            `https://ip-intelligence.abstractapi.com/v1/?api_key=${encodeURIComponent(abstractKey)}&ip_address=${encodeURIComponent(ip)}`
          );
          out.used.push("Abstract IP Intelligence");
          const sec = d?.security ?? {};
          for (const [cat, key] of [["vpn", "is_vpn"], ["proxy", "is_proxy"], ["tor", "is_tor"], ["hosting", "is_hosting"]] as const) {
            if (typeof sec[key] === "boolean")
              out.signals.push({ category: cat, name: `Abstract ${key}`, source: "Abstract", value: sec[key], evidence: `Abstract reports ${key}=${sec[key]}` });
          }
        } catch {
          out.unavailable.push("Abstract IP Intelligence (request failed or rate-limited)");
        }
      })()
    );
  }

  await Promise.all(jobs);
  return out;
}

/* ------------------------- combination logic ------------------------- */

export function combine(
  signals: Signal[],
  opts: { inferenceOnlyStatus?: DetectionStatus } = {}
): { status: DetectionStatus; confidence: Confidence; disagreed: boolean } {
  const measured = signals.filter((s) => s.value !== null && !s.inference);
  const inferred = signals.filter((s) => s.value !== null && s.inference);
  const pos = measured.filter((s) => s.value === true).length;
  const neg = measured.filter((s) => s.value === false).length;
  if (pos > 0 && neg > 0) return { status: "Inconclusive", confidence: "Low", disagreed: true };
  if (pos >= 2) return { status: "Detected", confidence: "High", disagreed: false };
  if (pos === 1) return { status: "Detected", confidence: "Medium", disagreed: false };
  if (neg >= 2) return { status: "Not Detected", confidence: "High", disagreed: false };
  if (neg === 1) return { status: "Not Detected", confidence: "Medium", disagreed: false };
  const infPos = inferred.filter((s) => s.value === true).length;
  if (infPos > 0) return { status: opts.inferenceOnlyStatus ?? "Likely", confidence: "Low", disagreed: false };
  return { status: "Unknown", confidence: "Unknown", disagreed: false };
}

function category(
  id: string,
  label: string,
  combined: { status: DetectionStatus; confidence: Confidence },
  explanation: string,
  sources: string[]
): CategoryResult {
  return { id, label, status: combined.status, confidence: combined.confidence, explanation, sources, lastUpdated: now() };
}

const reportCache = new Map<string, { at: number; value: AnonymityReport }>();
const REPORT_TTL_MS = 5 * 60 * 1000;

export async function detectAnonymity(intel: IpIntel): Promise<AnonymityReport> {
  const cached = reportCache.get(intel.ip);
  if (cached && Date.now() - cached.at < REPORT_TTL_MS) return cached.value;

  const signals: Signal[] = [];
  const disagreements: string[] = [];
  const sourcesUsed = new Set<string>(["ipwho.is security indicators (via IP lookup)"]);
  const unavailableSources: string[] = [];

  const base = (cat: string, name: string, value: boolean | null) => {
    if (value !== null)
      signals.push({ category: cat, name, source: "ipwho.is", value, evidence: `ipwho.is reports ${name}=${value}` });
  };
  base("vpn", "vpn", intel.vpn);
  base("proxy", "proxy", intel.proxy);
  base("tor", "tor", intel.tor);
  base("hosting", "hosting", intel.hosting);
  base("mobile", "mobile", intel.mobile);

  const text = ownershipText(intel);
  const vpnProvider = matchProvider(text, VPN_PROVIDERS);
  const hostingProvider = matchProvider(text, HOSTING_PROVIDERS);
  if (vpnProvider)
    signals.push({
      category: "vpn",
      name: "VPN provider ownership",
      source: "ASN/organization analysis",
      value: true,
      evidence: `Network ownership matches known VPN provider: ${vpnProvider} (${intel.asnOrg ?? intel.org ?? "organization on record"})`,
      inference: true,
    });
  if (hostingProvider)
    signals.push({
      category: "hosting",
      name: "Hosting provider ownership",
      source: "ASN/organization analysis",
      value: true,
      evidence: `Network ownership matches hosting provider: ${hostingProvider}`,
      inference: true,
    });
  if (intel.connectionType)
    signals.push({
      category: "network",
      name: "Connection type",
      source: "ipwho.is",
      value: true,
      evidence: `Provider connection type: ${intel.connectionType}`,
      inference: true,
    });

  const [torSet, optional] = await Promise.all([
    intel.isPublic ? torExitSet() : Promise.resolve(null),
    intel.isPublic ? optionalSignals(intel.ip) : Promise.resolve<OptionalSignals>({ signals: [], proxySubtypes: {}, fraudScore: null, usageType: null, used: [], unavailable: [] }),
  ]);
  signals.push(...optional.signals);
  optional.used.forEach((s) => sourcesUsed.add(s));
  unavailableSources.push(...optional.unavailable);
  if (!process.env.IPQUALITYSCORE_API_KEY) unavailableSources.push("IPQualityScore (no API key configured — optional)");
  if (!process.env.IP2LOCATION_API_KEY) unavailableSources.push("IP2Location (no API key configured — optional)");
  if (!process.env.ABSTRACT_API_KEY) unavailableSources.push("Abstract IP Intelligence (no API key configured — optional)");
  if (!process.env.IPINFO_TOKEN) unavailableSources.push("ipinfo privacy (no token configured — optional)");

  const byCat = (cat: string) => signals.filter((s) => s.category === cat);
  const srcOf = (cat: string) => [...new Set(byCat(cat).map((s) => s.source))];

  /* Tor — authoritative exit list wins over provider heuristics. */
  let tor: CategoryResult;
  if (!intel.isPublic) {
    tor = category("tor", "Tor Exit Node", { status: "Unknown", confidence: "Unknown" }, "Tor exit status only applies to public IP addresses.", []);
  } else if (torSet) {
    sourcesUsed.add("Tor Project bulk exit list");
    const inList = torSet.has(intel.ip);
    if (inList) {
      tor = category("tor", "Tor Exit Node", { status: "Detected", confidence: "High" }, "This IP appears in the Tor Project's current bulk exit list.", ["Tor Project bulk exit list"]);
    } else if (intel.version === 4) {
      tor = category("tor", "Tor Exit Node", { status: "Not Detected", confidence: "High" }, "This IPv4 address is not in the Tor Project's current bulk exit list. (Not every Tor connection is detectable this way — only traffic exiting via a listed exit relay.)", ["Tor Project bulk exit list"]);
    } else {
      const c = combine(byCat("tor"));
      tor = category("tor", "Tor Exit Node", c, "The bulk exit list is IPv4-focused, so IPv6 Tor status relies on provider indicators.", srcOf("tor"));
    }
  } else {
    unavailableSources.push("Tor Project bulk exit list (fetch failed)");
    const c = combine(byCat("tor"));
    tor = category("tor", "Tor Exit Node", c, "The Tor exit list could not be fetched; provider indicators were used instead.", srcOf("tor"));
  }

  const vpnC = combine(byCat("vpn"));
  if (vpnC.disagreed) disagreements.push("VPN: sources disagree (at least one reports VPN, another reports no VPN).");
  const vpn = category(
    "vpn",
    "VPN",
    vpnC,
    vpnC.status === "Detected"
      ? `VPN indicators were confirmed by ${srcOf("vpn").join(", ")}.${vpnProvider ? ` Identified provider: ${vpnProvider}.` : ""} Detection is probabilistic and never 100% certain.`
      : vpnC.status === "Likely"
        ? `Network ownership matches ${vpnProvider ?? "VPN infrastructure"}, but no VPN database confirmed it. Hosting alone never proves VPN use.`
        : vpnC.status === "Inconclusive"
          ? "Available sources disagree about VPN status, so no firm classification is made."
          : vpnC.status === "Not Detected"
            ? "No available source associates this IP with VPN infrastructure."
            : "No VPN intelligence was available for this IP from the configured sources.",
    srcOf("vpn")
  );

  const proxyC = combine(byCat("proxy"));
  if (proxyC.disagreed) disagreements.push("Proxy: sources disagree (at least one reports a proxy, another reports none).");
  const proxy = category(
    "proxy",
    "Proxy",
    proxyC,
    proxyC.status === "Detected"
      ? "Proxy indicators were reported by the listed sources. Residential and private proxies can evade public IP intelligence, so absence of a signal is not proof of a direct connection."
      : proxyC.status === "Not Detected"
        ? "No available source associates this IP with proxy infrastructure."
        : proxyC.status === "Inconclusive"
          ? "Available sources disagree about proxy status."
          : "No proxy intelligence was available for this IP from the configured sources.",
    srcOf("proxy")
  );

  const subtype = (id: string, label: string): CategoryResult => {
    const found = optional.proxySubtypes[id];
    if (found?.value === true)
      return category(id, label, { status: "Likely", confidence: "Medium" }, `Reported by ${found.source}.`, [found.source]);
    return category(
      id,
      label,
      { status: "Unknown", confidence: "Unknown" },
      "Proxy subtype cannot be determined from public IP intelligence alone; it requires inspecting headers of a request made through the proxy, which this tool does not do.",
      []
    );
  };
  const proxySubtypes: Record<string, CategoryResult> = {
    http: subtype("http", "HTTP Proxy"),
    https: subtype("https", "HTTPS Proxy"),
    socks: subtype("socks", "SOCKS Proxy"),
    transparent: subtype("transparent", "Transparent Proxy"),
    anonymous: subtype("anonymous", "Anonymous Proxy"),
    elite: subtype("elite", "Elite / High-Anonymity Proxy"),
  };

  const hostingC = combine(byCat("hosting"));
  const hosting = category(
    "hosting",
    "Hosting Provider",
    hostingC,
    hostingC.status === "Detected" || hostingC.status === "Likely"
      ? `This IP belongs to hosting infrastructure${hostingProvider ? ` operated by ${hostingProvider}` : ""}. A hosting IP is not automatically a VPN IP.`
      : hostingC.status === "Not Detected"
        ? "Providers report this IP is not hosting infrastructure."
        : "Hosting status could not be determined from the available sources.",
    srcOf("hosting")
  );
  const datacenter = category(
    "datacenter",
    "Datacenter",
    intel.datacenter !== null
      ? combine([{ category: "datacenter", name: "datacenter", source: "ipwho.is", value: intel.datacenter, evidence: `ipwho.is datacenter=${intel.datacenter}` }])
      : hostingC,
    intel.datacenter !== null
      ? "Datacenter status reported directly by a provider."
      : "Datacenter status follows the hosting classification when no dedicated datacenter signal exists.",
    srcOf("hosting")
  );

  const usage = (optional.usageType ?? intel.connectionType ?? "").toLowerCase();
  const mobileC = combine([
    ...byCat("mobile"),
    ...(usage.includes("mob") || usage.includes("cellular")
      ? [{ category: "mobile", name: "Usage type", source: "Provider usage classification", value: true, evidence: `Usage type: ${optional.usageType ?? intel.connectionType}`, inference: true } as Signal]
      : []),
  ]);
  const mobile = category(
    "mobile",
    "Mobile Network",
    mobileC,
    mobileC.status === "Detected" || mobileC.status === "Likely"
      ? "Evidence indicates a mobile carrier network."
      : mobileC.status === "Not Detected"
        ? "Providers report this is not a mobile network."
        : "No mobile-network evidence was available; the IP is not classified as mobile without supporting evidence.",
    srcOf("mobile")
  );

  const residentialSignals: Signal[] = [];
  if (intel.hosting === false)
    residentialSignals.push({ category: "residential", name: "Non-hosting report", source: "ipwho.is", value: true, evidence: "Provider reports hosting=false", inference: true });
  if (usage.includes("residential") || usage === "isp")
    residentialSignals.push({ category: "residential", name: "Usage type", source: "Provider usage classification", value: true, evidence: `Usage type: ${optional.usageType ?? intel.connectionType}`, inference: true });
  if (hostingC.status === "Detected")
    residentialSignals.push({ category: "residential", name: "Hosting classification", source: "Detection engine", value: false, evidence: "IP is classified as hosting/datacenter, not residential" });
  const residentialC = combine(residentialSignals);
  const residential = category(
    "residential",
    "Residential IP",
    residentialC,
    residentialC.status === "Likely" || residentialC.status === "Detected"
      ? "Evidence (non-hosting provider report and/or residential usage type) suggests a residential ISP connection. A residential IP is not automatically trustworthy."
      : residentialC.status === "Not Detected"
        ? "This IP is classified as hosting/datacenter infrastructure, not a residential connection."
        : "No residential evidence was available; the IP is not classified as residential without supporting evidence.",
    [...new Set(residentialSignals.map((s) => s.source))]
  );

  const corporateSignals: Signal[] =
    usage.includes("business") || usage.includes("corporate") || usage === "com"
      ? [{ category: "corporate", name: "Usage type", source: "Provider usage classification", value: true, evidence: `Usage type: ${optional.usageType ?? intel.connectionType}`, inference: true }]
      : [];
  const corporate = category(
    "corporate",
    "Corporate Network",
    combine(corporateSignals),
    corporateSignals.length
      ? "Provider usage classification indicates a business/corporate network."
      : "No corporate-network evidence was available from the configured sources.",
    corporateSignals.map((s) => s.source)
  );

  const networkType =
    tor.status === "Detected"
      ? "Tor Exit Node"
      : vpn.status === "Detected" || vpn.status === "Likely"
        ? "VPN"
        : proxy.status === "Detected"
          ? "Proxy"
          : hosting.status === "Detected" || hosting.status === "Likely"
            ? "Hosting / Datacenter"
            : mobile.status === "Detected" || mobile.status === "Likely"
              ? "Mobile"
              : residential.status === "Likely" || residential.status === "Detected"
                ? "Residential"
                : corporate.status === "Likely"
                  ? "Corporate"
                  : "Unknown";

  const measuredCount = signals.filter((s) => s.value !== null && !s.inference).length;
  const classificationConfidence: Confidence =
    disagreements.length > 0 ? "Low" : measuredCount >= 4 ? "High" : measuredCount >= 2 ? "Medium" : measuredCount === 1 ? "Low" : "Unknown";

  const riskSources: string[] = [];
  let riskScore: number | null = null;
  if (intel.abuseScore !== null) {
    riskScore = intel.abuseScore;
    riskSources.push("AbuseIPDB");
  }
  if (optional.fraudScore !== null) {
    riskScore = Math.max(riskScore ?? 0, optional.fraudScore);
    riskSources.push("IPQualityScore fraud score");
  }
  const reputationRisk = {
    level: (riskScore === null ? "Unknown" : riskScore >= 75 ? "High" : riskScore >= 25 ? "Medium" : "Low") as "High" | "Medium" | "Low" | "Unknown",
    score: riskScore,
    explanation:
      riskScore === null
        ? "No reputation data is available (configure ABUSEIPDB_API_KEY or IPQUALITYSCORE_API_KEY). Reputation risk is separate from VPN/proxy classification: VPN use is not malicious, and a residential IP is not automatically trustworthy."
        : `Reputation score ${riskScore}/100 from ${riskSources.join(", ")}. This measures abuse/fraud reports, not anonymity: VPN use is not inherently malicious.`,
    sources: riskSources,
  };

  const summaryParts: string[] = [];
  if (!intel.isPublic) {
    summaryParts.push(`This is a ${intel.ipType.toLowerCase()} address; public VPN/proxy intelligence does not apply.`);
  } else {
    if (hosting.status === "Detected" || hosting.status === "Likely")
      summaryParts.push(`This IP is associated with ${hostingProvider ? `${hostingProvider} ` : ""}hosting/datacenter infrastructure.`);
    if (vpn.status === "Detected") summaryParts.push(`A VPN classification was confirmed by ${vpn.sources.join(", ")}${vpnProvider ? ` (${vpnProvider})` : ""}.`);
    else if (vpn.status === "Likely") summaryParts.push("VPN use is likely based on network ownership, but no VPN database confirmed it.");
    else if (vpn.status === "Not Detected") summaryParts.push("A VPN classification was not confirmed by the available intelligence sources.");
    if (proxy.status === "Detected") summaryParts.push("Proxy indicators were detected.");
    if (tor.status === "Detected") summaryParts.push("This IP is a Tor exit node.");
    if (residential.status === "Likely") summaryParts.push("Evidence suggests a residential ISP connection.");
    if (mobile.status === "Detected" || mobile.status === "Likely") summaryParts.push("Evidence suggests a mobile carrier network.");
    if (disagreements.length) summaryParts.push("Some sources disagree; affected classifications are marked Inconclusive.");
    if (summaryParts.length === 0) summaryParts.push("The available sources did not confirm VPN, proxy, Tor, or hosting classifications for this IP.");
  }

  const report: AnonymityReport = {
    ip: intel.ip,
    version: intel.version,
    ipType: intel.ipType,
    isPublic: intel.isPublic,
    country: intel.country,
    countryCode: intel.countryCode,
    isp: intel.isp,
    asn: intel.asn,
    asnOrg: intel.asnOrg,
    networkType,
    vpn,
    vpnProvider,
    proxy,
    proxySubtypes,
    tor,
    hosting,
    hostingProvider,
    datacenter,
    residential,
    mobile,
    corporate,
    classificationConfidence,
    reputationRisk,
    signals,
    disagreements,
    summary: summaryParts.join(" "),
    sourcesUsed: [...sourcesUsed],
    unavailableSources,
    fetchedAt: now(),
  };
  reportCache.set(intel.ip, { at: Date.now(), value: report });
  return report;
}
