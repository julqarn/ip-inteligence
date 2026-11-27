import { PWA_ICONS } from "@/lib/pwaIcons";

export function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  return params.then(({ size }) => {
    const base64 = PWA_ICONS[size];
    if (!base64) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(Buffer.from(base64, "base64"), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  });
}
