// Автогенерація ШІ-інтер'єрів через Gemini API (ключ — vault int_gemini_api_key через integration_secrets()).
// Заголовок x-ai-secret (vault 'ai_upload_secret'). CORS — для сторінки затвердження /ai-pereglyad на сайті.
//   GET  ?action=models                         — моделі Gemini з генерацією зображень (перевірка ключа)
//   POST ?action=gen&code=SP-L134[&model=…]      — 1 кандидат → Storage kolekciya/ai-cand/{код}/… + ai_candidates
//   GET  ?action=list[&status=pending]           — кандидати з даними товару
//   POST ?action=proxy&model=…  — прохідний generateContent (скрипт будує запит сам)
//   GET  ?action=prompt&code=…  /  PUT ?action=add&code=…&model=… (тіло webp)  — генерація в скрипті (основний шлях: у функції бракує CPU на великі фото)
//   GET  ?action=queue[&limit=50&kinds=L,P]      — черга моделей (view ai_queue)
//   POST ?action=decide  {id, status, note}       — approved | rejected | pending | published (публікує скрипт scripts/ai_batch.py)
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const E = (k: string) => Deno.env.get(k)!;
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "x-ai-secret, content-type", "access-control-allow-methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", ...CORS } });
const DEF_MODEL = "gemini-3.1-flash-image"; // Nano Banana 2 — обрано за тестом 08.11 (якість ≈ Pro, удвічі дешевше)
const PRICE: Record<string, number> = { pro: 0.134, flash: 0.067 }; // орієнтовно за кадр 2K

type F = { w?: number[]; l?: number[]; h?: number[]; sub?: string; shape?: string[] };
const LAMP: Record<string, string> = { L: "chandelier", P: "pendant light", W: "wall sconce", F: "floor lamp", T: "table lamp", C: "ceiling light", O: "outdoor light" };

function prompt(kind: string, f: F, title: string) {
  const w = Math.max(f.w?.[1] ?? 0, f.l?.[1] ?? 0), h = f.h?.[1] ?? 0;
  const long = (f.l?.[1] ?? 0) >= 1.8 * (f.w?.[1] ?? 999) || /видовж|лінійн/i.test((f.sub ?? "") + title);
  const lamp = LAMP[kind] ?? "lamp";
  // масштаб: власник (08.11) — на тесті люстри завеликі для кімнати → просторіше приміщення, світильник дрібніший у кадрі
  const size = (w ? ` The ${lamp} is about ${w} cm ${long ? "long" : "wide"}${h ? ` and ${h} cm high` : ""}; keep this real-world size relative to the furniture.` : "") +
    (["L", "P", "C"].includes(kind) ? ` The room is spacious with a 2.8 m ceiling; the ${lamp} must not look oversized and takes no more than about one quarter of the frame width.` : "");
  // декор: власник (08.11) — інтер'єри виглядали нежилими
  const decor = kind === "O" ? " Potted plants, neat garden greenery and a doormat by the entrance." :
    kind === "T" ? "" : " Lived-in, styled home: a large green plant in a ceramic pot, a textured rug, cushions and a throw, a few books, a vase with fresh flowers or dried branches, framed artwork on the wall, small decor objects — tasteful and uncluttered.";
  let scene = "";
  switch (kind) {
    case "L": scene = long
      ? "Modern dining room. The chandelier from the reference hangs from the ceiling on its own original suspension about 80 cm above a long wooden dining table with chairs, centered over the table, its long side parallel to the table. White walls."
      : "Modern spacious living room. The chandelier from the reference hangs from the ceiling on its own original suspension above a low coffee table, occupying about one quarter of the frame width. Light oak floor, beige sofa, large window with sheer curtains."; break;
    case "P": scene = long
      ? "Modern dining room. The linear pendant from the reference hangs from the ceiling on its own original suspension about 75 cm above a long wooden dining table with chairs, its long side parallel to the table. White walls."
      : w && w <= 35
        ? "Contemporary kitchen with an island. Three identical pendants from the reference hang from the ceiling on their own original cords in a row above the kitchen island, about 75 cm above the countertop. Matte cabinets, stone countertop, bar stools."
        : "Modern dining room. The pendant from the reference hangs from the ceiling on its own original suspension about 75 cm above a round wooden dining table with chairs, centered over the table. Warm white walls."; break;
    case "W": scene = "Calm bedroom. Two identical wall sconces from the reference are mounted on a textured light-grey plaster wall on both sides of the bed headboard, at about 1.6 m height, each above a bedside table. Linen bedding."; break;
    case "F": scene = "Cozy living room corner. The floor lamp from the reference stands on a light wooden floor next to a soft armchair and a small side table, the full height of the lamp visible from base to top."; break;
    case "T": scene = "The table lamp from the reference stands on a wooden bedside table with a few books and a ceramic vase, calm bedroom softly blurred in the background, the lamp about one third of the frame height."; break;
    case "C": scene = "Bright living room with a flat white ceiling. The ceiling light from the reference is mounted flush on the ceiling, camera at eye level looking slightly up so both the light and the room are visible."; break;
    case "O": scene = "Modern house facade at dusk. The outdoor light from the reference is mounted on the wall beside the entrance door, switched on."; break;
  }
  return `Use the attached product photo as the exact reference. ${scene}${decor}${size} ` +
    `Eye-level camera, ${["L", "P", "C"].includes(kind) ? "28mm wide" : "35mm"} lens, ${kind === "T" ? "shallow depth of field" : "the whole room visible"}, realistic perspective. Evening, the ${lamp} is switched on, warm 3000K light, soft light spill on nearby walls and ceiling, natural shadows. ` +
    `Photorealistic interior photography, neutral warm palette, no people, no text, no logos, no watermarks, no other decorative lamps. ` +
    `Keep the ${lamp}'s design exactly as in the reference: same shape, proportions, number of arms and shades, materials, glass and metal color, and type of suspension.`;
}

const b64 = (buf: ArrayBuffer) => { let s = ""; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const db = createClient(E("SUPABASE_URL"), E("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { data: ok } = await db.rpc("ai_secret_ok", { s: req.headers.get("x-ai-secret") ?? "" });
  if (!ok) return json({ error: "forbidden" }, 403);
  const q = new URL(req.url).searchParams, action = q.get("action");
  const key = async () => (((await db.rpc("integration_secrets")).data ?? {}) as Record<string, string>).GEMINI_API_KEY;

  if (action === "models") {
    const k = await key(); if (!k) return json({ error: "no gemini_api_key" }, 400);
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": k } });
    const d = await r.json();
    return json(r.ok ? (d.models ?? []).map((m: { name: string }) => m.name).filter((n: string) => /image/i.test(n)) : d, r.status);
  }

  if (action === "gen") {
    const code = (q.get("code") ?? "").toUpperCase(), model = q.get("model") ?? DEF_MODEL;
    const k = await key(); if (!k) return json({ error: "no gemini_api_key" }, 400);
    const { data: m } = await db.from("models").select("code,kind_code,title,photo,facets").eq("code", code).maybeSingle();
    if (!m?.photo) return json({ error: "model/photo not found" }, 404);
    const ref = await fetch(String(m.photo).replace("/middle/", "/original/"), { headers: { "user-agent": "Mozilla/5.0 SvitloPlaza" } });
    if (!ref.ok) return json({ error: `ref ${ref.status}` }, 502);
    const mime = ref.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    const p = q.get("prompt") || prompt(m.kind_code, (m.facets ?? {}) as F, m.title ?? "");
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "x-goog-api-key": k, "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: b64(await ref.arrayBuffer()) } }, { text: p }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "4:5", imageSize: "2K" } },
      }),
    });
    const d = await r.json();
    if (!r.ok) return json({ error: d.error?.message ?? r.status }, 502);
    const part = (d.candidates?.[0]?.content?.parts ?? []).find((x: { inlineData?: unknown }) => x.inlineData);
    if (!part) return json({ error: "no image", finish: d.candidates?.[0]?.finishReason, block: d.promptFeedback }, 502);
    const om = part.inlineData.mimeType ?? "image/png";
    const path = `ai-cand/${code}/${Date.now().toString(36)}.${om.includes("jpeg") ? "jpg" : "png"}`;
    const up = await db.storage.from("kolekciya").upload(path, unb64(part.inlineData.data), { contentType: om, cacheControl: "31536000" });
    if (up.error) return json({ error: up.error.message }, 500);
    const url = db.storage.from("kolekciya").getPublicUrl(path).data.publicUrl;
    const { data: c, error } = await db.from("ai_candidates").insert({
      model_code: code, url, gen_model: model, prompt: p, cost_usd: /pro/.test(model) ? PRICE.pro : PRICE.flash,
    }).select("id").single();
    if (error) return json({ error: error.message }, 500);
    return json({ id: c.id, code, url });
  }

  if (action === "proxy" && req.method === "POST") { // прохідний виклик Gemini: тіло й відповідь не розбираємо (ліміт CPU)
    const k = await key(); if (!k) return json({ error: "no gemini_api_key" }, 400);
    const model = q.get("model") ?? DEF_MODEL;
    if (!/^gemini-[\w.-]+$/.test(model)) return json({ error: "bad model" }, 400);
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "x-goog-api-key": k, "content-type": "application/json" }, body: req.body, duplex: "half",
    } as RequestInit);
    return new Response(r.body, { status: r.status, headers: { "content-type": "application/json", ...CORS } });
  }

  if (action === "prompt") { // для генерації поза функцією (scripts/ai_batch.py): промпт + референс
    const { data: m } = await db.from("models").select("code,kind_code,title,photo,facets").eq("code", (q.get("code") ?? "").toUpperCase()).maybeSingle();
    if (!m?.photo) return json({ error: "model/photo not found" }, 404);
    return json({ code: m.code, photo: String(m.photo).replace("/middle/", "/original/"), prompt: prompt(m.kind_code, (m.facets ?? {}) as F, m.title ?? "") });
  }

  if (action === "add" && req.method === "PUT") { // готовий кадр (webp) від скрипта → кандидат
    const code = (q.get("code") ?? "").toUpperCase(), model = q.get("model") ?? DEF_MODEL;
    const buf = await req.arrayBuffer();
    if (buf.byteLength < 10_000 || buf.byteLength > 8_000_000) return json({ error: "bad size" }, 400);
    const path = `ai-cand/${code}/${Date.now().toString(36)}.webp`;
    const up = await db.storage.from("kolekciya").upload(path, buf, { contentType: "image/webp", cacheControl: "31536000" });
    if (up.error) return json({ error: up.error.message }, 500);
    const url = db.storage.from("kolekciya").getPublicUrl(path).data.publicUrl;
    const { data: c, error } = await db.from("ai_candidates").insert({
      model_code: code, url, gen_model: model, prompt: req.headers.get("x-prompt") ? decodeURIComponent(req.headers.get("x-prompt")!) : "", cost_usd: /pro/.test(model) ? PRICE.pro : PRICE.flash,
    }).select("id").single();
    return error ? json({ error: error.message }, 500) : json({ id: c.id, code, url });
  }

  if (action === "queue") { // черга: LineF у наявності без ШІ-кадрів, від найдорожчих
    let qq = db.from("ai_queue").select("code,kind_code,price").order("price", { ascending: false }).limit(Number(q.get("limit") ?? 50));
    if (q.get("kinds")) qq = qq.in("kind_code", q.get("kinds")!.split(","));
    const { data, error } = await qq;
    return error ? json({ error: error.message }, 500) : json(data);
  }

  if (action === "list") {
    const st = q.get("status") ?? "pending";
    const { data, error } = await db.from("ai_candidates").select("id,model_code,url,gen_model,status,note,created_at,models(title,slug,photo,kind_code,facets)")
      .eq("status", st).order("model_code").order("id").limit(Number(q.get("limit") ?? 500));
    if (error) return json({ error: error.message }, 500);
    return json(data);
  }

  if (action === "decide" && req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    if (!["approved", "rejected", "pending", "published"].includes(b.status)) return json({ error: "bad status" }, 400);
    const { error } = await db.from("ai_candidates").update({ status: b.status, note: b.note ?? null, decided_at: new Date().toISOString() })
      .eq("id", b.id).in("status", ["pending", "approved", "rejected"]);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }
  return json({ error: "unknown action" }, 400);
});
