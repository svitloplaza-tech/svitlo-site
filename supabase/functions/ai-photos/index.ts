// ШІ-інтер'єри товарів (Firefly) → Storage kolekciya/ai/{код}/{код}_int_{N}-{версія}.webp + models.photos_ai.
// Виклик: заголовок x-ai-secret (vault 'ai_upload_secret').
//   PUT  ?code=SP-L327&n=1   тіло = webp  → завантажити/замінити кадр N
//   DELETE ?code=SP-L327&n=1              → прибрати кадр N із photos_ai (файл лишається)
//   GET  ?code=SP-L327                    → поточний список
// Скрипт для власника: scripts/ai_photos.py.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const E = (k: string) => Deno.env.get(k)!;
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  const db = createClient(E("SUPABASE_URL"), E("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { data: ok } = await db.rpc("ai_secret_ok", { s: req.headers.get("x-ai-secret") ?? "" });
  if (!ok) return json({ error: "forbidden" }, 403);
  const q = new URL(req.url).searchParams;
  const code = (q.get("code") ?? "").toUpperCase();
  if (!/^SP-[A-Z]\d+(\.\d+)?$/.test(code)) return json({ error: "bad code" }, 400);
  const { data: m } = await db.from("models").select("code,slug,photos_ai").eq("code", code).maybeSingle();
  if (!m) return json({ error: "model not found" }, 404);
  const list = (m.photos_ai ?? []) as string[];
  if (req.method === "GET") return json({ code, slug: m.slug, photos_ai: list });

  const n = Number(q.get("n"));
  if (!Number.isInteger(n) || n < 1 || n > 9) return json({ error: "bad n" }, 400);
  // кадр N = файл {код}_int_{N}-{версія}.webp: при заміні — нове ім'я (кеш /f/ — 1 рік, без урахування ?query)
  const isN = (u: string) => new RegExp(`/${code}_int_${n}(-[a-z0-9]+)?\\.webp$`).test(u);
  const num = (u: string) => Number(u.match(/_int_(\d+)/)?.[1] ?? 99);

  let next: string[];
  if (req.method === "DELETE") next = list.filter((u) => !isN(u));
  else if (req.method === "PUT") {
    const buf = await req.arrayBuffer();
    if (buf.byteLength < 10_000 || buf.byteLength > 8_000_000) return json({ error: "bad size" }, 400);
    const path = `ai/${code}/${code}_int_${n}-${Date.now().toString(36)}.webp`;
    const up = await db.storage.from("kolekciya").upload(path, buf, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
    if (up.error) return json({ error: up.error.message }, 500);
    const url = db.storage.from("kolekciya").getPublicUrl(path).data.publicUrl;
    next = [...list.filter((u) => !isN(u)), url].sort((a, b) => num(a) - num(b));
  } else return json({ error: "method" }, 405);

  const { error } = await db.from("models").update({ photos_ai: next }).eq("code", code);
  if (error) return json({ error: error.message }, 500);
  return json({ code, slug: m.slug, photos_ai: next });
});
