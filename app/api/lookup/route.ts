import { z } from "zod";
import { isValidIp } from "@/lib/ip";
import { clientKeyFrom, jsonError, lookupIp, rateLimited } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  ip: z.string().trim().min(1).max(45).refine(isValidIp, "Invalid IP address"),
});

export async function GET(req: Request) {
  if (rateLimited(clientKeyFrom(req))) {
    return jsonError("Rate limit exceeded. Please wait a minute and try again.", 429);
  }
  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({ ip: searchParams.get("ip") ?? "" });
  if (!parsed.success) {
    return jsonError("Please provide a valid IPv4 or IPv6 address, e.g. ?ip=8.8.8.8", 400);
  }
  try {
    const intel = await lookupIp(parsed.data.ip);
    return Response.json({ ok: true, data: intel });
  } catch {
    return jsonError(
      "All IP lookup providers are currently unavailable. Please try again shortly.",
      502
    );
  }
}
