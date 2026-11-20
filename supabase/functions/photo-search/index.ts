// Пошук за фото (публічний): POST {"image": "data:image/jpeg;base64,…", "n": 24}
// → {"items": [{code, score, url, model: {…рядок catalog_models…}}]}
// Ліміт: 20 пошуків з однієї IP за 10 хв. Викликають сайт (з браузера) і Staff App.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { embedImages } from "../_shared/embed.ts";

const E = (k: string) => Deno.env.get(k) ?? "";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, authorization, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS" };
const out = (b: unknown, status = 200) => Response.json(b, { status, headers: CORS });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return out({ error: "POST" }, 405);
  const body = await req.json().catch(() => null) as { image?: string; n?: number } | null;
  const image = body?.image ?? "";
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(image)) return out({ error: "Потрібне фото JPG, PNG або WebP" }, 400);
  if (image.length > 2_500_000) return out({ error: "Фото завелике" }, 413);
  const n = Math.min(Math.max(Number(body?.n) || 24, 1), 60);

  const db = createClient(E("SUPABASE_URL"), E("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const ip = (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "?").split(",")[0].trim();
  const { data: allow } = await db.rpc("photo_search_allow", { p_ip: ip });
  if (allow === false) return out({ error: "Забагато пошуків. Спробуйте за кілька хвилин." }, 429);

  const { data: sec } = await db.rpc("integration_secrets");
  const s = sec as Record<string, string>;
  let v: number[];
  try { [v] = await embedImages(s.CF_ACCOUNT_ID, s.CF_AI_TOKEN, [image]); }
  catch (e) { console.error(e); return out({ error: "Не вдалося обробити фото, спробуйте інше" }, 502); }

  const { data: hits, error } = await db.rpc("photo_match_top", { q: JSON.stringify(v), n });
  if (error) { console.error(error); return out({ error: "Помилка пошуку" }, 500); }
  const list = (hits ?? []) as { model_code: string; score: number; url: string }[];
  const { data: models } = await db.from("catalog_models").select("*").in("code", list.map((h) => h.model_code));
  const by = new Map(((models ?? []) as { code: string }[]).map((m) => [m.code, m]));
  return out({ items: list.filter((h) => by.has(h.model_code))
    .map((h) => ({ code: h.model_code, score: Math.round(h.score * 1000) / 1000, url: h.url, model: by.get(h.model_code) })) });
});
