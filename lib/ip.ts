/**
 * IP parsing, validation and classification utilities.
 * Pure TypeScript — safe to use on both client and server.
 */

export type IpVersion = 4 | 6;

export type IpClass =
  | "public"
  | "private"
  | "loopback"
  | "link-local"
  | "cgnat"
  | "multicast"
  | "reserved"
  | "documentation"
  | "unspecified";

export interface IpClassification {
  version: IpVersion;
  ipClass: IpClass;
  isPublic: boolean;
  label: string;
  explanation: string;
}

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

// Pragmatic IPv6 validation: full, compressed, and IPv4-mapped forms.
const IPV6_RE =
  /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

export function ipVersion(ip: string): IpVersion | null {
  const value = ip.trim();
  if (IPV4_RE.test(value)) return 4;
  if (value.includes(":") && IPV6_RE.test(value)) return 6;
  return null;
}

export function isValidIp(ip: string): boolean {
  return ipVersion(ip) !== null;
}

export function validationError(ip: string): string | null {
  const value = ip.trim();
  if (!value) return "Enter an IP address to look up.";
  if (/\s/.test(value)) return "IP addresses cannot contain spaces.";
  if (value.includes("/") ) return "Enter a single IP address, not a CIDR range.";
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value) && !value.includes(":")) {
    return "That looks like a domain name. Use the DNS Lookup tool for domains, or enter an IP address here.";
  }
  if (!isValidIp(value)) {
    return "That is not a valid IPv4 or IPv6 address. Check for typos — for example 8.8.8.8 or 2606:4700:4700::1111.";
  }
  return null;
}

function ipv4ToInt(ip: string): number {
  return ip
    .split(".")
    .reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function inV4(ip: string, base: string, prefix: number): boolean {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

export function expandIpv6(ip: string): number[] | null {
  let value = ip.trim().toLowerCase();
  // IPv4-mapped tail
  const v4Match = value.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Match) {
    const n = ipv4ToInt(v4Match[1]);
    value =
      value.slice(0, value.length - v4Match[1].length) +
      ((n >>> 16) & 0xffff).toString(16) +
      ":" +
      (n & 0xffff).toString(16);
  }
  const [left, right] = value.split("::");
  const leftParts = left ? left.split(":").filter(Boolean) : [];
  const rightParts = right ? right.split(":").filter(Boolean) : [];
  if (!value.includes("::") && leftParts.length !== 8) return null;
  const missing = 8 - leftParts.length - rightParts.length;
  if (missing < 0) return null;
  const parts = [...leftParts, ...Array(missing).fill("0"), ...rightParts];
  if (parts.length !== 8) return null;
  const nums = parts.map((p) => parseInt(p, 16));
  return nums.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff) ? null : nums;
}

export function classifyIp(ip: string): IpClassification | null {
  const version = ipVersion(ip);
  if (!version) return null;
  const value = ip.trim();

  const make = (ipClass: IpClass, label: string, explanation: string): IpClassification => ({
    version,
    ipClass,
    isPublic: ipClass === "public",
    label,
    explanation,
  });

  if (version === 4) {
    if (value === "0.0.0.0")
      return make("unspecified", "Unspecified", "0.0.0.0 is the unspecified address. It does not identify a host on the public internet, so no geolocation exists for it.");
    if (inV4(value, "10.0.0.0", 8) || inV4(value, "172.16.0.0", 12) || inV4(value, "192.168.0.0", 16))
      return make("private", "Private", "This is a private (RFC 1918) address used inside home and office networks. It is not routable on the public internet, so public geolocation, ISP and ASN data do not exist for it.");
    if (inV4(value, "127.0.0.0", 8))
      return make("loopback", "Loopback", "This is a loopback address that points to the local device itself. It has no public location or ISP.");
    if (inV4(value, "169.254.0.0", 16))
      return make("link-local", "Link-local", "This is a link-local address, valid only on the local network segment. It has no public geolocation.");
    if (inV4(value, "100.64.0.0", 10))
      return make("cgnat", "CGNAT shared address space", "This address is in carrier-grade NAT shared space (100.64.0.0/10). It is used between ISPs and subscribers and does not map to a single public location.");
    if (inV4(value, "224.0.0.0", 4))
      return make("multicast", "Multicast", "This is a multicast group address, not an individual host, so it has no geolocation.");
    if (
      inV4(value, "192.0.2.0", 24) ||
      inV4(value, "198.51.100.0", 24) ||
      inV4(value, "203.0.113.0", 24)
    )
      return make("documentation", "Documentation (TEST-NET)", "This address is reserved for documentation examples and is not assigned to any real network.");
    if (inV4(value, "240.0.0.0", 4) || value === "255.255.255.255" || inV4(value, "0.0.0.0", 8) || inV4(value, "192.0.0.0", 24) || inV4(value, "198.18.0.0", 15))
      return make("reserved", "Reserved", "This address is in a reserved range that is not assigned for public internet use.");
    return make("public", "Public", "This is a public IP address routable on the internet.");
  }

  const parts = expandIpv6(value);
  if (!parts) return null;
  if (parts.every((p) => p === 0))
    return make("unspecified", "Unspecified", "The all-zeros IPv6 address is unspecified and does not identify a public host.");
  if (parts.slice(0, 7).every((p) => p === 0) && parts[7] === 1)
    return make("loopback", "Loopback", "This is the IPv6 loopback address (::1), pointing to the local device itself.");
  if ((parts[0] & 0xffc0) === 0xfe80)
    return make("link-local", "Link-local", "This is an IPv6 link-local address (fe80::/10), valid only on the local network segment.");
  if ((parts[0] & 0xfe00) === 0xfc00)
    return make("private", "Unique local (private)", "This is an IPv6 unique-local address (fc00::/7), the IPv6 equivalent of a private address. It is not routable on the public internet.");
  if ((parts[0] & 0xff00) === 0xff00)
    return make("multicast", "Multicast", "This is an IPv6 multicast group address, not an individual host.");
  if (parts[0] === 0x2001 && parts[1] === 0x0db8)
    return make("documentation", "Documentation", "2001:db8::/32 is reserved for documentation examples and is not assigned to any real network.");
  // IPv4-mapped ::ffff:a.b.c.d — classify by embedded IPv4
  if (parts.slice(0, 5).every((p) => p === 0) && parts[5] === 0xffff) {
    const v4 = `${parts[6] >> 8}.${parts[6] & 0xff}.${parts[7] >> 8}.${parts[7] & 0xff}`;
    const inner = classifyIp(v4);
    if (inner) return { ...inner, version: 6 };
  }
  return make("public", "Public", "This is a public IPv6 address routable on the internet.");
}

/** Reverse-DNS zone name for PTR lookups. */
export function reverseDnsName(ip: string): string | null {
  const version = ipVersion(ip);
  if (!version) return null;
  if (version === 4) {
    return ip.trim().split(".").reverse().join(".") + ".in-addr.arpa";
  }
  const parts = expandIpv6(ip);
  if (!parts) return null;
  const nibbles = parts
    .map((p) => p.toString(16).padStart(4, "0"))
    .join("")
    .split("")
    .reverse()
    .join(".");
  return nibbles + ".ip6.arpa";
}

const CONTINENTS: Record<string, string> = {
  AF: "Africa",
  AN: "Antarctica",
  AS: "Asia",
  EU: "Europe",
  NA: "North America",
  OC: "Oceania",
  SA: "South America",
};

export function continentName(code: string | null | undefined): string | null {
  if (!code) return null;
  return CONTINENTS[code.toUpperCase()] ?? null;
}

/** Country flag emoji from an ISO 3166-1 alpha-2 code. */
export function flagEmoji(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "🌐";
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "🌐";
  return String.fromCodePoint(
    ...[...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

export function isValidDomain(domain: string): boolean {
  const value = domain.trim().toLowerCase();
  if (!value || value.length > 253) return false;
  return /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(value);
}
