import { z } from "zod";
import { clientKeyFrom, jsonError, rateLimited } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  asn: z
    .string()
    .trim()
    .regex(/^AS?\d{1,10}$/i, "Invalid ASN"),
});

/** ASN (autonomous system) lookup via RDAP autnum. */
export async function GET(req: Request) {
  if (rateLimited(clientKeyFrom(req))) {
    return jsonError("Rate limit exceeded. Please wait a minute and try again.", 429);
  }
  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({ asn: searchParams.get("asn") ?? "" });
  if (!parsed.success) {
    return jsonError("Provide an ASN such as AS15169 or 15169.", 400);
  }
  const number = parsed.data.asn.replace(/^AS/i, "");

  try {
    const res = await fetch(`https://rdap.org/autnum/${number}`, {
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
    const orgs = entities
      .map((e: any) => {
        const vcard = Array.isArray(e.vcardArray?.[1]) ? e.vcardArray[1] : [];
        const fn = vcard.find((row: any) => row[0] === "fn")?.[3];
        return {
          handle: e.handle ?? null,
          roles: Array.isArray(e.roles) ? e.roles : [],
          name: typeof fn === "string" ? fn : null,
        };
      })
      .filter((e: any) => e.name || e.handle);

    return Response.json({
      ok: true,
      data: {
        asn: `AS${number}`,
        name: data.name ?? null,
        handle: data.handle ?? null,
        type: data.type ?? null,
        startAutnum: data.startAutnum ?? null,
        endAutnum: data.endAutnum ?? null,
        status: Array.isArray(data.status) ? data.status : [],
        country: data.country ?? null,
        organizations: orgs,
        events: Array.isArray(data.events)
          ? data.events.map((e: any) => ({ action: e.eventAction ?? null, date: e.eventDate ?? null }))
          : [],
        source: "RDAP (rdap.org → authoritative RIR)",
      },
    });
  } catch {
    return jsonError("ASN lookup failed. The registry service could not be reached.", 502);
  }
}
