import { z } from "zod";
import { classifyIp, isValidIp } from "@/lib/ip";
import { clientKeyFrom, jsonError, rateLimited } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  ip: z.string().trim().min(1).max(45).refine(isValidIp, "Invalid IP address"),
});

/**
 * WHOIS/RDAP via rdap.org, which redirects to the authoritative
 * Regional Internet Registry (ARIN, RIPE, APNIC, LACNIC, AFRINIC).
 */
export async function GET(req: Request) {
  if (rateLimited(clientKeyFrom(req))) {
    return jsonError("Rate limit exceeded. Please wait a minute and try again.", 429);
  }
  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({ ip: searchParams.get("ip") ?? "" });
  if (!parsed.success) return jsonError("Please provide a valid IP address.", 400);

  const cls = classifyIp(parsed.data.ip);
  if (!cls?.isPublic) {
    return Response.json({
      ok: true,
      data: {
        ip: parsed.data.ip,
        available: false,
        note: `${cls?.label ?? "Non-public"} addresses are not registered in public RDAP/WHOIS databases.`,
      },
    });
  }

  try {
    const res = await fetch(`https://rdap.org/ip/${encodeURIComponent(parsed.data.ip)}`, {
      headers: {
        Accept: "application/rdap+json, application/json",
        "User-Agent": "IP-Intelligence/1.0",
      },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`RDAP HTTP ${res.status}`);
    const data = await res.json();

    const entities = Array.isArray(data.entities) ? data.entities : [];
    const registrant = entities
      .map((e: any) => {
        const vcard = Array.isArray(e.vcardArray?.[1]) ? e.vcardArray[1] : [];
        const fn = vcard.find((row: any) => row[0] === "fn")?.[3];
        const email = vcard.find((row: any) => row[0] === "email")?.[3];
        return {
          handle: e.handle ?? null,
          roles: Array.isArray(e.roles) ? e.roles : [],
          name: typeof fn === "string" ? fn : null,
          email: typeof email === "string" ? email : null,
        };
      })
      .filter((e: any) => e.name || e.handle);

    const events = Array.isArray(data.events)
      ? data.events.map((e: any) => ({ action: e.eventAction ?? null, date: e.eventDate ?? null }))
      : [];

    const cidrs = Array.isArray(data.cidr0_cidrs)
      ? data.cidr0_cidrs.map((c: any) =>
          c.v4prefix ? `${c.v4prefix}/${c.length}` : c.v6prefix ? `${c.v6prefix}/${c.length}` : null
        ).filter(Boolean)
      : [];

    return Response.json({
      ok: true,
      data: {
        ip: parsed.data.ip,
        available: true,
        handle: data.handle ?? null,
        name: data.name ?? null,
        type: data.type ?? null,
        startAddress: data.startAddress ?? null,
        endAddress: data.endAddress ?? null,
        cidrs,
        country: data.country ?? null,
        status: Array.isArray(data.status) ? data.status : [],
        registry: data.port43 ?? null,
        entities: registrant,
        events,
        source: "RDAP (rdap.org → authoritative RIR)",
      },
    });
  } catch {
    return jsonError("RDAP lookup failed. The registry service could not be reached.", 502);
  }
}
