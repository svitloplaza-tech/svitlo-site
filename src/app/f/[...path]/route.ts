import { SB_PUBLIC } from "@/lib/img";

// Проксі фото Supabase Storage на власному домені: без x-robots-tag, кеш 1 рік (Cache API Cloudflare — без повторних запитів до Supabase).
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: Request, { params }: Ctx) {
  const { path } = await params;
  if (!path?.length || path.some((s) => !s || s === ".." || s === ".")) return new Response("Not found", { status: 404 });
  const rel = path.map(encodeURIComponent).join("/");
  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(new URL(req.url).origin + "/f/" + rel);
  if (cache) { const hit = await cache.match(key); if (hit) return hit; }
  const r = await fetch(SB_PUBLIC + rel);
  if (!r.ok) return new Response("Not found", { status: 404, headers: { "cache-control": "public, max-age=300" } });
  const res = new Response(r.body, { headers: {
    "content-type": r.headers.get("content-type") || "image/webp",
    "cache-control": "public, max-age=31536000, immutable",
    "access-control-allow-origin": "*",
  } });
  if (cache) await cache.put(key, res.clone());
  return res;
}
