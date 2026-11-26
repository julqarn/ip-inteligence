/**
 * Transparent Internet Privacy Score engine.
 *
 * Formula: the overall score is the weighted average of the individual
 * test scores that could actually be measured. Tests that are missing,
 * unsupported, or inconclusive are EXCLUDED from the average — they never
 * reduce the score. A public IP by itself is a normal fact of internet
 * connectivity, not a vulnerability, so mere IP visibility scores neutral.
 * The score summarizes measured signals only; a high score does not
 * guarantee anonymity or security.
 */

import type { IpIntel } from "./providers";
import type { ConnectivityResult, DnsLeakResult, WebRtcResult } from "./browserTests";

export type TestStatus = "good" | "concern" | "exposure" | "inconclusive";

export interface PrivacyTestResult {
  id: string;
  name: string;
  status: TestStatus;
  result: string;
  explanation: string;
  details: string[];
  recommendation: string;
  /** 0-100, or null when the test could not be measured (excluded). */
  score: number | null;
  weight: number;
}

export interface PrivacyScore {
  overall: number | null;
  tests: PrivacyTestResult[];
  risks: string[];
  recommendations: string[];
  formula: string;
}

export type IndicatorLabel = "Detected" | "Not Detected" | "Unknown" | "Inconclusive";

export function indicatorLabel(value: boolean | null, inconclusive = false): IndicatorLabel {
  if (inconclusive) return "Inconclusive";
  if (value === null) return "Unknown";
  return value ? "Detected" : "Not Detected";
}

export function evaluateWebRtc(webrtc: WebRtcResult | null, publicIp: string | null): PrivacyTestResult {
  const base = {
    id: "webrtc",
    name: "WebRTC Leak Test",
    weight: 3,
    recommendation:
      "If you use a VPN, choose one with WebRTC leak protection, or disable WebRTC in your browser for sensitive sessions.",
  };
  if (!webrtc || !webrtc.supported) {
    return {
      ...base,
      status: "inconclusive",
      result: "WebRTC is unavailable in this browser",
      explanation: "The test could not run, so no conclusion is drawn and the score is unaffected.",
      details: [],
      score: null,
    };
  }
  const foreignPublic = webrtc.publicIps.filter((ip) => publicIp && ip !== publicIp);
  if (foreignPublic.length > 0) {
    return {
      ...base,
      status: "exposure",
      result: `WebRTC exposed a different public IP: ${foreignPublic.join(", ")}`,
      explanation:
        "Websites using WebRTC may see this address in addition to your normal public IP. With a VPN active, this can reveal the underlying connection.",
      details: [
        `Public candidates: ${webrtc.publicIps.join(", ") || "none"}`,
        `Private candidates: ${webrtc.privateIps.join(", ") || "none"}`,
        `mDNS-masked candidates: ${webrtc.mdnsCandidates}`,
      ],
      score: 20,
    };
  }
  if (webrtc.publicIps.length > 0) {
    return {
      ...base,
      status: "good",
      result: "WebRTC candidates match your public IP",
      explanation:
        "WebRTC exposed only the same public IP your browser already uses for normal requests — no additional address was revealed.",
      details: [
        `Public candidates: ${webrtc.publicIps.join(", ")}`,
        `mDNS-masked candidates: ${webrtc.mdnsCandidates}`,
      ],
      score: 90,
    };
  }
  return {
    ...base,
    status: "good",
    result: "No raw IP candidates exposed",
    explanation:
      "Modern browsers mask local addresses behind mDNS names; none of the candidates revealed a usable IP address.",
    details: [
      `Candidates seen: ${webrtc.rawCandidateCount}`,
      `mDNS-masked candidates: ${webrtc.mdnsCandidates}`,
      `Private candidates: ${webrtc.privateIps.join(", ") || "none"}`,
    ],
    score: 100,
  };
}

export function evaluateDns(
  dns: DnsLeakResult | null,
  resolverIntel: IpIntel | null,
  intel: IpIntel | null
): PrivacyTestResult {
  const base = {
    id: "dns",
    name: "DNS Leak Diagnostics",
    weight: 3,
    recommendation:
      "Use your VPN's DNS servers or a trusted encrypted DNS (DoH/DoT) resolver so DNS queries follow the same path as your traffic.",
  };
  if (!dns || dns.error || !dns.resolverIp) {
    return {
      ...base,
      status: "inconclusive",
      result: "DNS resolver could not be determined",
      explanation:
        "The EDNS diagnostic endpoint did not report a resolver (it may be blocked). No conclusion is drawn and the score is unaffected.",
      details: dns?.error ? [dns.error] : [],
      score: null,
    };
  }
  const resolverOrg = resolverIntel?.isp ?? resolverIntel?.org ?? null;
  const sameNetwork =
    !!resolverIntel && !!intel &&
    ((resolverIntel.asn && intel.asn && resolverIntel.asn === intel.asn) ||
      (resolverOrg && intel.isp && resolverOrg.toLowerCase() === intel.isp.toLowerCase()));
  const details = [
    `Detected resolver IP: ${dns.resolverIp}`,
    `Resolver organization: ${resolverOrg ?? "Not Available"}`,
    `Resolver location: ${resolverIntel ? [resolverIntel.city, resolverIntel.country].filter(Boolean).join(", ") || "Not Available" : dns.resolverGeo ?? "Not Available"}`,
    `Resolver ASN: ${resolverIntel?.asn ?? "Not Available"}`,
    `Method: ${dns.method}`,
    "Multiple resolver networks: a single EDNS probe observes one resolver path; run the test again to see if it changes.",
  ];
  if (sameNetwork) {
    return {
      ...base,
      status: "good",
      result: "DNS resolver matches your connection's network",
      explanation:
        "The resolver that answered belongs to the same network as your public IP, which is expected for a standard ISP connection without a separate DNS service.",
      details,
      score: 90,
    };
  }
  return {
    ...base,
    status: "concern",
    result: "DNS resolver is on a different network than your public IP",
    explanation:
      "This is normal when using a VPN's DNS, encrypted DNS (DoH), or a public resolver. It becomes a leak concern only if you expected DNS to stay inside a VPN tunnel but it resolves elsewhere.",
    details,
    score: 60,
  };
}

export function evaluateConnectivity(conn: ConnectivityResult | null): PrivacyTestResult {
  const base = {
    id: "ipv6",
    name: "IPv6 Connectivity Test",
    weight: 1,
    recommendation:
      "IPv6 is normal and desirable. If you rely on a VPN, confirm it tunnels IPv6 traffic as well as IPv4.",
  };
  if (!conn) {
    return {
      ...base,
      status: "inconclusive",
      result: "Connectivity test has not run yet",
      explanation: "Run the test to measure IPv4 and IPv6 availability from this browser.",
      details: [],
      score: null,
    };
  }
  const overall = conn.ipv4Available && conn.ipv6Available
    ? "Dual-stack (IPv4 + IPv6)"
    : conn.ipv6Available
      ? "IPv6 only"
      : conn.ipv4Available
        ? "IPv4 only"
        : "No public connectivity detected";
  return {
    ...base,
    status: conn.ipv4Available || conn.ipv6Available ? "good" : "inconclusive",
    result: `IPv4: ${conn.ipv4Available ? "Available" : "Unavailable"} · IPv6: ${conn.ipv6Available ? "Available" : "Unavailable"}`,
    explanation:
      "IPv6 availability is a connectivity fact, not a vulnerability. It matters for privacy only when a VPN or proxy handles IPv4 but lets IPv6 bypass the tunnel.",
    details: [
      `Public IPv4: ${conn.ipv4 ?? "Not detected"}`,
      `Public IPv6: ${conn.ipv6 ?? "Not detected"}`,
      `Overall connectivity: ${overall}`,
      `Checked: ${new Date(conn.checkedAt).toLocaleString()}`,
    ],
    score: conn.ipv4Available || conn.ipv6Available ? 100 : null,
  };
}

export function evaluateAnonymizers(intel: IpIntel | null): PrivacyTestResult {
  const base = {
    id: "vpn",
    name: "VPN & Proxy Detection",
    weight: 2,
    recommendation:
      "Provider indicators are probabilistic. For stronger privacy, use a reputable VPN and verify with the WebRTC and DNS tests above.",
  };
  if (!intel || !intel.isPublic) {
    return {
      ...base,
      status: "inconclusive",
      result: "No public IP report available",
      explanation: "VPN/proxy indicators need a public IP lookup first.",
      details: [],
      score: null,
    };
  }
  const vpn = indicatorLabel(intel.vpn);
  const proxy = indicatorLabel(intel.proxy);
  const tor = indicatorLabel(intel.tor);
  // Hosting alone never proves VPN use — label it inconclusive for VPN purposes.
  const hostingForVpn = intel.vpn === null && intel.hosting === true;
  const details = [
    `VPN: ${vpn}`,
    `Proxy: ${proxy}`,
    `Tor exit node: ${tor}`,
    `Hosting / datacenter: ${indicatorLabel(intel.hosting ?? intel.datacenter)}`,
    `Mobile network: ${indicatorLabel(intel.mobile)}`,
    `Residential classification: ${intel.hosting === false ? "Likely residential (provider reports non-hosting)" : intel.hosting === true ? "Hosting/datacenter range" : "Unknown"}`,
    `Confidence: ${intel.vpn !== null || intel.proxy !== null || intel.tor !== null ? "Medium (single-provider indicators)" : "Low (no direct anonymizer signals)"}`,
  ];
  if (intel.tor === true) {
    return {
      ...base,
      status: "good",
      result: "Tor exit node detected",
      explanation: "Traffic appears to exit through Tor, which strongly anonymizes the origin — though some sites block Tor exits.",
      details,
      score: 90,
    };
  }
  if (intel.vpn === true) {
    return {
      ...base,
      status: "good",
      result: "VPN indicator detected",
      explanation: "The provider associates this IP with VPN infrastructure. Detection is probabilistic and never guaranteed.",
      details,
      score: 85,
    };
  }
  if (intel.proxy === true) {
    return {
      ...base,
      status: "concern",
      result: "Proxy indicator detected",
      explanation: "The provider associates this IP with proxy infrastructure. Proxies hide the origin IP but may not encrypt traffic.",
      details,
      score: 65,
    };
  }
  if (hostingForVpn) {
    return {
      ...base,
      status: "inconclusive",
      result: "Hosting IP — VPN status inconclusive",
      explanation:
        "This IP belongs to hosting/datacenter space, but that alone does not prove VPN use, so it is not classified as a VPN.",
      details,
      score: 70,
    };
  }
  if (intel.vpn === false && intel.proxy === false && intel.tor === false) {
    return {
      ...base,
      status: "good",
      result: "No VPN, proxy, or Tor indicators detected",
      explanation:
        "Providers report no anonymizer signals for this IP. That is the expected result for a normal residential connection and is not itself a risk.",
      details,
      score: 80,
    };
  }
  return {
    ...base,
    status: "inconclusive",
    result: "Anonymizer indicators unknown",
    explanation: "The configured providers did not report VPN/proxy/Tor signals for this IP, so no conclusion is drawn.",
    details,
    score: null,
  };
}

export function evaluateConsistency(
  intel: IpIntel | null,
  browserTimezone: string | null,
  browserLanguage: string | null
): PrivacyTestResult {
  const base = {
    id: "consistency",
    name: "IP & Timezone Consistency",
    weight: 2,
    recommendation:
      "A mismatch is common with VPNs, travel, or manually set device timezones. Align device timezone/language with your VPN exit region if consistency matters.",
  };
  if (!intel?.timezone || !browserTimezone) {
    return {
      ...base,
      status: "inconclusive",
      result: "Timezone comparison unavailable",
      explanation: "Both an IP timezone and a browser timezone are required for this check.",
      details: [],
      score: null,
    };
  }
  const tzMatch = intel.timezone === browserTimezone;
  const langRegion = browserLanguage?.split("-")[1]?.toUpperCase() ?? null;
  const langMatch = langRegion && intel.countryCode ? langRegion === intel.countryCode.toUpperCase() : null;
  const details = [
    `IP timezone: ${intel.timezone}`,
    `Browser timezone: ${browserTimezone}`,
    `IP country: ${intel.country ?? "Not Available"} (${intel.countryCode ?? "Not Available"})`,
    `Browser language: ${browserLanguage ?? "Not Available"}`,
    `Language-region match: ${langMatch === null ? "Not Available" : langMatch ? "Match" : "Mismatch"}`,
  ];
  if (tzMatch && langMatch !== false) {
    return {
      ...base,
      status: "good",
      result: "Browser signals are consistent with the IP location",
      explanation: "Timezone and locale align with the IP's reported location — typical for a direct connection.",
      details,
      score: 100,
    };
  }
  return {
    ...base,
    status: "concern",
    result: tzMatch ? "Language region differs from IP country" : "Browser timezone differs from IP timezone",
    explanation:
      "A mismatch does not automatically indicate VPN usage — travel, device settings, and multilingual locales cause the same signal. It is one consistency clue among many.",
    details,
    score: tzMatch ? 75 : 55,
  };
}

export function evaluateFingerprintSignals(signalCount: number | null): PrivacyTestResult {
  const base = {
    id: "fingerprint",
    name: "Browser Fingerprint Signals",
    weight: 2,
    recommendation:
      "Use a browser with anti-fingerprinting protections, limit extensions, and avoid unusual window sizes/fonts to blend in.",
  };
  if (signalCount === null) {
    return {
      ...base,
      status: "inconclusive",
      result: "Fingerprint signal count unavailable",
      explanation: "Run the Browser Fingerprint Lab to measure observable signals locally.",
      details: [],
      score: null,
    };
  }
  const score = Math.max(35, 100 - signalCount * 4);
  return {
    ...base,
    status: score >= 75 ? "good" : score >= 50 ? "concern" : "exposure",
    result: `${signalCount} observable fingerprint signals`,
    explanation:
      "More observable signals make a browser easier to distinguish. This is an exposure estimate from local signals only — not a global uniqueness percentage.",
    details: [`Signals counted locally: ${signalCount}`, "No fingerprint data leaves this browser."],
    score,
  };
}

export function computePrivacyScore(tests: PrivacyTestResult[]): PrivacyScore {
  const measured = tests.filter((t) => t.score !== null);
  const totalWeight = measured.reduce((sum, t) => sum + t.weight, 0);
  const overall =
    measured.length === 0
      ? null
      : Math.round(measured.reduce((sum, t) => sum + (t.score as number) * t.weight, 0) / totalWeight);
  const risks = tests
    .filter((t) => t.status === "exposure" || t.status === "concern")
    .map((t) => `${t.name}: ${t.result}`);
  const recommendations = [...new Set(tests.filter((t) => t.status !== "good").map((t) => t.recommendation))];
  return {
    overall,
    tests,
    risks,
    recommendations,
    formula:
      "Overall = weighted average of measured test scores (WebRTC ×3, DNS ×3, VPN/Proxy ×2, Consistency ×2, Fingerprint ×2, IPv6 ×1). Inconclusive or unsupported tests are excluded, never scored as zero. A visible public IP alone is neutral — it is how the internet routes traffic back to you.",
  };
}
