// Індексація фото каталогу для пошуку за фото (Cloudflare Workers AI, embeddinggemma-2, 768).
// pg_cron кожні 10 хв викликає photo_index_dispatch() → ця функція (заголовок x-notify-secret).
// Секрети: select set_integration_secret('cf_account_id','…'); select set_integration_secret('cf_ai_token','…');
// Вручну: POST з x-notify-secret; ?limit=16 — обробити не більше N фото.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { embedImages, fetchAsDataUri } from "../_shared/embed.ts";

const E = (k: string) => Deno.env.get(k) ?? "";

Deno.serve(async (req) => {
  const db = createClient(E("SUPABASE_URL"), E("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { data: ok } = await db.rpc("notify_secret_ok", { s: req.headers.get("x-notify-secret") ?? "" });
  if (!ok) return new Response("forbidden", { status: 403 });
  const { data: sec } = await db.rpc("integration_secrets");
  const acc = (sec as Record<string, string>)?.CF_ACCOUNT_ID, tok = (sec as Record<string, string>)?.CF_AI_TOKEN;
  if (!acc || !tok) return Response.json({ error: "немає секретів cf_account_id / cf_ai_token" }, { status: 500 });

  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 100000);
  const { data: left0, error: se } = await db.rpc("photo_vectors_sync");
  if (se) return Response.json({ error: se.message }, { status: 500 });
  const t0 = Date.now();
  let done = 0, failed = 0;
  while (Date.now() - t0 < 100_000 && done + failed < limit) {
    const { data: rows } = await db.from("photo_vectors").select("url,tries").is("emb", null).lt("tries", 3)
      .order("updated_at").limit(Math.min(8, limit - done - failed));
    if (!rows?.length) break;
    const imgs = await Promise.all(rows.map((r) => fetchAsDataUri(r.url).catch((e) => e as Error)));
    const good = rows.map((r, i) => ({ r, d: imgs[i] })).filter((x) => typeof x.d === "string") as { r: typeof rows[0]; d: string }[];
    let vecs: number[][] = [];
    let aiErr = "";
    if (good.length) {
      try { vecs = await embedImages(acc, tok, good.map((x) => x.d)); }
      catch (e) { aiErr = String((e as Error).message ?? e).slice(0, 300); }
    }
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i], d = imgs[i];
      const gi = good.findIndex((x) => x.r.url === r.url);
      const v = gi >= 0 ? vecs[gi] : undefined;
      if (v) { await db.from("photo_vectors").update({ emb: JSON.stringify(v), error: null, updated_at: new Date().toISOString() }).eq("url", r.url); done++; }
      else {
        const err = typeof d === "string" ? (aiErr || "немає вектора") : String(d.message ?? d).slice(0, 300);
        await db.from("photo_vectors").update({ tries: r.tries + 1, error: err, updated_at: new Date().toISOString() }).eq("url", r.url); failed++;
      }
    }
    if (aiErr && !vecs.length && good.length === rows.length) break; // помилка AI (ключ/ліміт) — не палити спроби
  }
  return Response.json({ todo_before: left0, done, failed, ms: Date.now() - t0 });
});
