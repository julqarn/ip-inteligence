import { z } from "zod";
import { classifyIp, isValidDomain, isValidIp, reverseDnsName } from "@/lib/ip";
import { clientKeyFrom, jsonError, rateLimited } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = ["A", "AAAA", "MX", "NS", "TXT", "CNAME", "PTR", "SOA"] as const;

const querySchema = z.object({
  name: z.string().trim().min(1).max(253),
  type: z.enum(TYPES).default("A"),
});

interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

const TYPE_NAMES: Record<number, string> = {
  1: "A",
  2: "NS",
  5: "CNAME",
  6: "SOA",
  12: "PTR",
  15: "MX",
  16: "TXT",
  28: "AAAA",
};

/**
 * DNS lookups via Cloudflare DNS-over-HTTPS (public resolver).
 * Accepts a domain name, or an IP address with type=PTR for reverse DNS.
 * Only the fixed Cloudflare DoH endpoint is contacted — no arbitrary
 * hosts are ever fetched (SSRF-safe).
 */
export async function GET(req: Request) {
  if (rateLimited(clientKeyFrom(req))) {
    return jsonError("Rate limit exceeded. Please wait a minute and try again.", 429);
  }
  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    name: searchParams.get("name") ?? "",
    type: searchParams.get("type") ?? "A",
  });
  if (!parsed.success) {
    return jsonError("Provide a valid domain (or an IP with type=PTR) and a record type.", 400);
  }

  let { name, type } = parsed.data;

  if (isValidIp(name)) {
    // Reverse DNS path. Private/reserved targets are not probed.
    const cls = classifyIp(name);
    if (!cls?.isPublic) {
      return Response.json({
        ok: true,
        data: {
          query: name,
          type: "PTR",
          records: [],
          note: `Reverse DNS is not queried for ${cls?.label.toLowerCase() ?? "non-public"} addresses; they have no public PTR records.`,
        },
      });
    }
    const reverse = reverseDnsName(name);
    if (!reverse) return jsonError("Could not build a reverse-DNS name for that IP.", 400);
    name = reverse;
    type = "PTR";
  } else if (!isValidDomain(name)) {
    return jsonError("That is not a valid domain name or IP address.", 400);
  }

  try {
    const started = Date.now();
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
      {
        headers: { Accept: "application/dns-json" },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      }
    );
    if (!res.ok) throw new Error(`DoH HTTP ${res.status}`);
    const data = await res.json();
    const answers: DohAnswer[] = Array.isArray(data.Answer) ? data.Answer : [];
    return Response.json({
      ok: true,
      data: {
        query: name,
        type,
        status: data.Status === 0 ? "NOERROR" : `DNS status ${data.Status}`,
        latencyMs: Date.now() - started,
        resolver: "Cloudflare 1.1.1.1 (DNS-over-HTTPS)",
        records: answers.map((a) => ({
          name: a.name,
          type: TYPE_NAMES[a.type] ?? String(a.type),
          ttl: a.TTL,
          value: a.data,
        })),
      },
    });
  } catch {
    return jsonError("DNS lookup failed. The resolver could not be reached.", 502);
  }
}
