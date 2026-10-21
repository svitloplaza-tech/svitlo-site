// Автостріччка соцмереж для /sotsmerezhi. Запускається щоночі (pg_cron 'social-sync' → social_sync_dispatch) або вручну.
// Акаунти: social_accounts з feed = true. feed_id: YouTube — ID каналу (UC…; якщо порожньо — береться з url),
// Telegram — ім'я каналу (без @; якщо порожньо — з url), Instagram/Facebook — визначаються з токена сторінки самі.
// Секрети (Vault, set_integration_secret): int_instagram_token (Instagram Login, оновлюється сам)
//   або int_meta_page_token (токен сторінки Facebook — для FB і пов'язаного Instagram).
// Фото копіюються в Storage-кошик 'social' (посилання соцмереж згодом прострочуються).
// Вручну: POST з x-notify-secret; ?network=telegram — лише одна мережа; ?dry=1&network=telegram&id=durov — перевірка без запису.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const E = (k: string) => Deno.env.get(k) ?? "";
const KEEP = 12; // скільки автопостів тримати на мережу
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });
type Item = { external_id: string; url: string; image: string | null; caption: string | null; published_at: string | null; media: string };
type Res = { items: Item[]; followers?: number | null; feed_id?: string };

const unesc = (s: string) => s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
const clip = (s: string | null | undefined, n = 300) => (s ? (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s) : null);
const day = (s: string | null | undefined) => (s ? new Date(s).toISOString().slice(0, 10) : null);
const num = (s: string) => { const m = s.replace(/\s/g, "").replace(",", ".").match(/([\d.]+)([KM]?)/i); if (!m) return null; return Math.round(parseFloat(m[1]) * ({ k: 1e3, m: 1e6 }[m[2].toLowerCase()] ?? 1)); };
const get = async (u: string, init: RequestInit = {}) => { const r = await fetch(u, { ...init, headers: { "user-agent": UA, "accept-language": "uk,en;q=0.8", ...(init.headers ?? {}) } }); if (!r.ok) throw new Error(`${r.status} ${u.split("?")[0]}`); return r; };

async function youtube(id: string, url: string): Promise<Res> {
  if (!/^UC[\w-]{22}$/.test(id)) { // ID каналу зі сторінки @handle
    const h = await (await get(url, { headers: { cookie: "SOCS=CAI; CONSENT=YES+1" } })).text();
    id = h.match(/"(?:channelId|externalId)":"(UC[\w-]{22})"/)?.[1] ?? h.match(/channel\/(UC[\w-]{22})/)?.[1] ?? "";
    if (!id) throw new Error("youtube: не знайдено ID каналу");
  }
  const x = await (await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`)).text();
  const items = [...x.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0, KEEP).map(([, e]) => {
    const v = e.match(/<yt:videoId>([^<]+)/)![1];
    return { external_id: v, url: e.match(/<link rel="alternate" href="([^"]+)"/)?.[1] ?? `https://www.youtube.com/watch?v=${v}`,
      image: `https://i.ytimg.com/vi/${v}/maxresdefault.jpg|https://i.ytimg.com/vi/${v}/mqdefault.jpg`,
      caption: clip(unesc(e.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "")), published_at: day(e.match(/<published>([^<]+)/)?.[1]), media: "video" };
  });
  return { items, feed_id: id };
}

async function telegram(id: string, url: string): Promise<Res> {
  const name = (id || url.match(/t\.me\/(?:s\/)?([\w]+)/)?.[1] || "").replace(/^@/, "");
  if (!name) throw new Error("telegram: не вказано канал");
  const h = await (await get(`https://t.me/s/${name}`)).text();
  const bg = (s: string, cls: string) => s.match(new RegExp(`${cls}[^>]*background-image:url\\('([^']+)'\\)`))?.[1] ?? null;
  const items = h.split('<div class="tgme_widget_message_wrap').slice(1).map((b) => {
    const post = b.match(/data-post="([^"]+)"/)?.[1]; if (!post || /service_message/.test(b.slice(0, 600))) return null;
    const vid = bg(b, "tgme_widget_message_video_thumb");
    const text = b.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1];
    return { external_id: post.split("/")[1], url: `https://t.me/${post}`, image: bg(b, "tgme_widget_message_photo_wrap") ?? vid,
      caption: clip(text ? unesc(text) : null), published_at: day(b.match(/<time datetime="([^"]+)"/)?.[1]), media: vid ? "video" : "image" };
  }).filter((i): i is Item => !!i && !!(i.image || i.caption)).reverse().slice(0, KEEP);
  const subs = h.match(/counter_value">([^<]+)<\/span>\s*<span class="counter_type">(?:subscribers|підписник|подписчик)/i)?.[1];
  return { items, followers: subs ? num(subs) : null, feed_id: name };
}

async function instagram(id: string, sec: Record<string, string>, db: ReturnType<typeof createClient>): Promise<Res> {
  const f = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
  let base: string, tok: string, who: string;
  if (sec.INSTAGRAM_TOKEN) { // Instagram Login: довгий токен на 60 днів — подовжуємо щоночі
    tok = sec.INSTAGRAM_TOKEN; base = "https://graph.instagram.com"; who = "me";
    const r = await fetch(`${base}/refresh_access_token?grant_type=ig_refresh_token&access_token=${tok}`).then((x) => x.json()).catch(() => null);
    if (r?.access_token && r.access_token !== tok) { tok = r.access_token; await db.rpc("set_integration_secret", { p_name: "instagram_token", p_value: tok }); }
  } else if (sec.META_PAGE_TOKEN) { tok = sec.META_PAGE_TOKEN; base = "https://graph.facebook.com";
    who = id || (await (await get(`${base}/me?fields=instagram_business_account&access_token=${tok}`)).json()).instagram_business_account?.id;
    if (!who) throw new Error("instagram: сторінка Facebook не пов'язана з професійним акаунтом Instagram"); }
  else throw new Error("instagram: немає токена (int_instagram_token або int_meta_page_token)");
  const m = await (await get(`${base}/${who}/media?fields=${f}&limit=${KEEP}&access_token=${tok}`)).json();
  const p = await fetch(`${base}/${who}?fields=followers_count&access_token=${tok}`).then((x) => x.json()).catch(() => ({}));
  const items = (m.data ?? []).map((d: any) => ({ external_id: d.id, url: d.permalink, image: d.media_type === "VIDEO" ? d.thumbnail_url : d.media_url,
    caption: clip(d.caption), published_at: day(d.timestamp), media: d.media_type === "VIDEO" ? "video" : "image" }));
  return { items, followers: p.followers_count ?? null, feed_id: who === "me" ? undefined : who };
}

async function facebook(id: string, sec: Record<string, string>): Promise<Res> {
  if (!sec.META_PAGE_TOKEN) throw new Error("facebook: немає int_meta_page_token");
  const t = sec.META_PAGE_TOKEN, b = "https://graph.facebook.com";
  id ||= (await (await get(`${b}/me?fields=id&access_token=${t}`)).json()).id; // токен сторінки → /me = сторінка
  const m = await (await get(`${b}/${id}/posts?fields=id,message,full_picture,permalink_url,created_time&limit=${KEEP}&access_token=${t}`)).json();
  const p = await fetch(`${b}/${id}?fields=followers_count&access_token=${t}`).then((x) => x.json()).catch(() => ({}));
  const items = (m.data ?? []).filter((d: any) => d.full_picture || d.message).map((d: any) => ({ external_id: d.id, url: d.permalink_url,
    image: d.full_picture ?? null, caption: clip(d.message), published_at: day(d.created_time), media: "image" }));
  return { items, followers: p.followers_count ?? null, feed_id: id };
}

// Ручна добірка: POST {"add": ["посилання на пост", …]} — бере og:image / og:description зі сторінки поста,
// фото копіює в Storage, пише social_posts (source='manual', sort 100+порядок). Повторне посилання оновлює запис.
const MON: Record<string, string> = { january: "01", february: "02", march: "03", april: "04", may: "05", june: "06", july: "07", august: "08", september: "09", october: "10", november: "11", december: "12" };
const meta = (h: string, k: string) => unesc(h.match(new RegExp(`<meta[^>]+(?:property|name)="${k}"[^>]+content="([^"]*)"`))?.[1] ?? h.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${k}"`))?.[1] ?? "");
async function og(url: string) {
  const r = await fetch(url, { headers: { "user-agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", "accept-language": "uk,en;q=0.8" }, redirect: "follow" });
  const h = await r.text();
  const final = meta(h, "og:url") || r.url;
  const desc = meta(h, "og:description") || meta(h, "description");
  const d = desc.match(/ on (\w+) (\d{1,2}), (\d{4})/i); // «… on March 12, 2025: "підпис"»
  const cap = desc.match(/:\s*["“](.*)["”]\.?\s*$/s)?.[1] ?? (meta(h, "og:title") || desc);
  return { final, image: meta(h, "og:image"), caption: clip(cap.replace(/\s+/g, " ").trim() || null, 300),
    published_at: d && MON[d[1].toLowerCase()] ? `${d[3]}-${MON[d[1].toLowerCase()]}-${d[2].padStart(2, "0")}` : null };
}
async function store(db: ReturnType<typeof createClient>, folder: string, id: string, srcs: string[]) {
  for (const src of srcs) {
    try {
      const res = await fetch(src, { headers: { "user-agent": UA } });
      if (!res.ok) continue;
      const type = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
      const path = `${folder}/${id.replace(/[^\w-]/g, "_")}.${type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg"}`;
      const up = await db.storage.from("social").upload(path, await res.arrayBuffer(), { contentType: type, upsert: true, cacheControl: "31536000" });
      if (!up.error) return db.storage.from("social").getPublicUrl(path).data.publicUrl;
    } catch { /* наступне джерело */ }
  }
  return null;
}

Deno.serve(async (req) => {
  const db = createClient(E("SUPABASE_URL"), E("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { data: ok } = await db.rpc("notify_secret_ok", { s: req.headers.get("x-notify-secret") ?? "" });
  if (!ok) return json({ error: "forbidden" }, 403);
  const q = new URL(req.url).searchParams;
  const { data: vs } = await db.rpc("integration_secrets");
  const sec = (vs ?? {}) as Record<string, string>;
  const run = (net: string, id: string, url: string) =>
    net === "youtube" ? youtube(id, url) : net === "telegram" ? telegram(id, url) : net === "instagram" ? instagram(id, sec, db)
      : net === "facebook" ? facebook(id, sec) : Promise.reject(new Error(`${net}: автостріччка не підтримується`));

  if (q.get("dry")) { // перевірка без запису
    try { return json(await run(q.get("network") ?? "", q.get("id") ?? "", q.get("url") ?? "")); } catch (e) { return json({ error: String(e) }, 500); }
  }

  const body = await req.json().catch(() => ({}));
  if (Array.isArray(body.add)) {
    const out: unknown[] = [];
    for (const [i, u] of (body.add as string[]).entries()) {
      try {
        const o = await og(u);
        const network = /instagram\.com/.test(o.final) ? "instagram" : /facebook\.com|fb\.watch/.test(o.final) ? "facebook" : /youtu/.test(o.final) ? "youtube" : /t\.me/.test(o.final) ? "telegram" : "other";
        const ext = o.final.match(/\/(?:p|reel|reels|videos|posts|watch)\/([\w-]+)/)?.[1] ?? o.final.replace(/\W+/g, "_").slice(-60);
        if (!o.image) throw new Error("немає og:image (сторінка недоступна без входу?)");
        const image = await store(db, `manual/${network}`, ext, [o.image]);
        if (!image) throw new Error("не вдалося зберегти фото");
        const row = { network, external_id: ext, url: o.final.split("?")[0], image, caption: o.caption, published_at: o.published_at,
          media: /\/(reel|reels|videos|watch)\//.test(o.final) ? "video" : "image", source: "manual", sort: 100 + i, is_active: true };
        const { error } = await db.from("social_posts").upsert(row, { onConflict: "network,external_id" });
        if (error) throw error;
        out.push({ url: u, ok: true, network, ext, caption: o.caption?.slice(0, 60), published_at: o.published_at });
      } catch (e) { out.push({ url: u, ok: false, error: String(e) }); }
    }
    return json({ ok: true, added: out });
  }

  let accs = (await db.from("social_accounts").select("*").eq("feed", true).eq("is_active", true)).data ?? [];
  if (q.get("network")) accs = accs.filter((a) => a.network === q.get("network"));
  const report: unknown[] = [];
  for (const a of accs) {
    try {
      const r = await run(a.network, a.feed_id ?? "", a.url);
      const { data: have } = await db.from("social_posts").select("external_id,image").eq("network", a.network).eq("source", "auto");
      const old = new Map((have ?? []).map((p) => [p.external_id, p.image]));
      const rows = [];
      for (const it of r.items) {
        let image = old.get(it.external_id) ?? null;
        if (!image && it.image) for (const src of it.image.split("|")) { // копія фото в Storage
          try {
            const res = await fetch(src, { headers: { "user-agent": UA } });
            if (!res.ok) continue;
            const type = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
            const path = `${a.network}/${it.external_id.replace(/[^\w-]/g, "_")}.${type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg"}`;
            const up = await db.storage.from("social").upload(path, await res.arrayBuffer(), { contentType: type, upsert: true, cacheControl: "31536000" });
            if (!up.error) { image = db.storage.from("social").getPublicUrl(path).data.publicUrl; break; }
          } catch { /* наступне джерело */ }
        }
        rows.push({ network: a.network, external_id: it.external_id, url: it.url, image, caption: it.caption, published_at: it.published_at,
          media: it.media, source: "auto", sort: 1000, is_active: true });
      }
      if (rows.length) { const { error } = await db.from("social_posts").upsert(rows, { onConflict: "network,external_id" }); if (error) throw error; }
      // прибрати автопости, що випали з останніх KEEP
      const keep = new Set(r.items.map((i) => i.external_id));
      const stale = (have ?? []).filter((p) => !keep.has(p.external_id));
      if (stale.length && r.items.length) {
        await db.from("social_posts").delete().eq("network", a.network).eq("source", "auto").in("external_id", stale.map((p) => p.external_id));
        const files = stale.map((p) => p.image?.split("/object/public/social/")[1]).filter(Boolean) as string[];
        if (files.length) await db.storage.from("social").remove(files);
      }
      await db.from("social_accounts").update({ synced_at: new Date().toISOString(), sync_error: null,
        ...(r.followers != null ? { followers: r.followers } : {}), ...(r.feed_id && !a.feed_id ? { feed_id: r.feed_id } : {}) }).eq("id", a.id);
      report.push({ network: a.network, posts: rows.length, removed: stale.length, followers: r.followers ?? null });
    } catch (e) {
      await db.from("social_accounts").update({ sync_error: String(e).slice(0, 500) }).eq("id", a.id);
      report.push({ network: a.network, error: String(e) });
    }
  }
  return json({ ok: true, report });
});
