import { classifyIp, isValidIp } from "@/lib/ip";
import { clientKeyFrom, jsonError, lookupIp, rateLimited } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Detect the visitor's public IP.
 * In production (Vercel etc.) the platform forwards the real client IP.
 * In local development there is no forwarded public IP, so we fall back to
 * asking a provider what public IP this server egresses from — which, on a
 * developer machine, is the developer's own public IP.
 */
export async function GET(req: Request) {
  if (rateLimited(clientKeyFrom(req))) {
    return jsonError("Rate limit exceeded. Please wait a minute and try again.", 429);
  }

  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  const candidate = [forwarded, realIp].find(
    (v): v is string => !!v && isValidIp(v) && (classifyIp(v)?.isPublic ?? false)
  );

  try {
    if (candidate) {
      const intel = await lookupIp(candidate);
      return Response.json({ ok: true, detectedVia: "request headers", data: intel });
    }

    // Local-development fallback: ask a provider which public IP this
    // server egresses from. ipapi.co rate-limits shared egress IPs, so
    // fall back to ipwho.is when needed.
    let egressIp: string | null = null;
    try {
      const res = await fetch("https://ipapi.co/json/", {
        headers: { Accept: "application/json", "User-Agent": "IP-Intelligence/1.0" },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.ip && isValidIp(data.ip)) egressIp = data.ip;
      }
    } catch {}
    if (!egressIp) {
      const res = await fetch("https://ipwho.is/", {
        headers: { Accept: "application/json", "User-Agent": "IP-Intelligence/1.0" },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error("egress detection failed");
      const data = await res.json();
      if (!data?.ip || !isValidIp(data.ip)) throw new Error("egress detection failed");
      egressIp = data.ip;
    }
    if (!egressIp) throw new Error("egress detection failed");
    const intel = await lookupIp(egressIp);
    return Response.json({
      ok: true,
      detectedVia: "server egress (local development fallback)",
      data: intel,
    });
  } catch {
    return jsonError("Could not detect your public IP address right now.", 502);
  }
}
