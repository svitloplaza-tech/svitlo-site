import { unstable_cache } from "next/cache";
import { db } from "./supabase";

export type Kind = { code: string; name: string; name_plural: string; slug: string; sort: number };
export type CatalogModel = {
  code: string; slug: string; title: string; kind_code: string; series_id: string; series_name: string | null; series_number: number;
  photo: string | null; own: boolean; sort: number; price_from: number | null; in_stock: boolean;
  variants_count: number; colors: string[] | null;
};
export type Variant = {
  sku: string; model_code: string; size: string | null; color: string | null; color_code: string | null; temp: string | null;
  price: number | null; old_price: number | null; availability: string | null; in_stock: boolean; photo: string | null; photos: string[];
};
export type Model = {
  code: string; slug: string; series_id: string; kind_code: string; kind_name: string; title: string; description: string | null;
  photo: string | null; photo_interior: string | null; own: boolean;
};

export const REVALIDATE = 3600;

/** Кеш у пам'яті воркера (живе, поки Cloudflare тримає ізолят «теплим»): довідники й списки каталогу
 *  не перезапитуються з Supabase на кожну сторінку. Ціни/наявність оновлюються не пізніше ніж за TTL. */
const MEMO = new Map<string, { t: number; p: Promise<unknown> }>();
const TTL = 10 * 60 * 1000;
// + спільний кеш даних Next (KV) між усіма копіями воркера: оновлення раз на 3 год
function memo<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = MEMO.get(key), now = Date.now();
  if (hit && now - hit.t < TTL) return hit.p as Promise<T>;
  const p = unstable_cache(fn, ["sp", key], { revalidate: 10800, tags: ["catalog"] })().catch((e) => { MEMO.delete(key); throw e; });
  MEMO.set(key, { t: now, p });
  return p;
}

export function getKinds(): Promise<(Kind & { count: number })[]> { return memo("kinds", loadKinds); }
async function loadKinds(): Promise<(Kind & { count: number })[]> {
  const { data: kinds } = await db.from("kinds").select("*").order("sort");
  const counts = await Promise.all((kinds ?? []).map((k: Kind) =>
    db.from("models").select("*", { count: "exact", head: true }).eq("kind_code", k.code).eq("is_active", true)));
  return (kinds ?? []).map((k: Kind, i: number) => ({ ...k, count: counts[i].count ?? 0 }));
}

export function getTotals() { return memo("totals", loadTotals); }
async function loadTotals() {
  const [s, m, v] = await Promise.all([
    db.from("series").select("*", { count: "exact", head: true }),
    db.from("models").select("*", { count: "exact", head: true }).eq("is_active", true),
    db.from("variants").select("*", { count: "exact", head: true }).eq("is_active", true),
  ]);
  return { series: s.count ?? 0, models: m.count ?? 0, variants: v.count ?? 0 };
}

/** Усі моделі типу (до ~900 рядків), фільтруємо й гортаємо на сервері. */
export function getCatalogByKind(kind: string): Promise<CatalogModel[]> { return memo("kind:" + kind, () => loadByKind(kind)); }
async function loadByKind(kind: string): Promise<CatalogModel[]> {
  const out: CatalogModel[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("catalog_models").select("*").eq("kind_code", kind)
      .order("series_number").order("sort").range(from, from + 999);
    if (error) throw error;
    out.push(...(data as CatalogModel[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function getModel(slug: string) {
  const { data: model } = await db.from("models").select("*").eq("slug", slug.toLowerCase()).eq("is_active", true).maybeSingle();
  if (!model) return null;
  const [{ data: variants }, { data: series }, { data: siblings }] = await Promise.all([
    db.from("variants").select("*").eq("model_code", model.code).eq("is_active", true).order("price", { nullsFirst: false }),
    db.from("series").select("*").eq("id", model.series_id).maybeSingle(),
    db.from("catalog_models").select("*").eq("series_id", model.series_id).neq("code", model.code).order("sort").limit(12),
  ]);
  return { model: model as Model, variants: (variants ?? []) as Variant[], series, siblings: (siblings ?? []) as CatalogModel[] };
}

export async function search(q: string): Promise<CatalogModel[]> {
  const s = q.trim().replace(/[%,()]/g, " ");
  if (s.length < 2) return [];
  const { data } = await db.from("catalog_models").select("*")
    .or(`title.ilike.%${s}%,code.ilike.%${s}%,series_name.ilike.%${s}%`).limit(60);
  return (data ?? []) as CatalogModel[];
}

export async function getSetting<T = Record<string, unknown>>(key: string): Promise<T | null> {
  const { data } = await db.from("site_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? null;
}

/* ---------- кольори ---------- */
export const COLOR_HEX: Record<string, string> = {
  "білий": "#F4F4F2", "чорний": "#141414", "хром": "#C9CBD0", "латунь": "#B8945A", "золотий": "#D2AE5B",
  "графіт": "#4A4A4E", "бурштин": "#C7782F", "зелений": "#3F6E52", "кавовий": "#6B4A33", "рожеве золото": "#D9A08C",
  "сірий": "#8C8C8C", "червоний": "#B2392F", "срібний": "#C4C6CA", "чорний хром": "#3A3B3E", "титан": "#A8A39A",
  "мідь": "#B87333", "бежевий": "#D8C7A8", "прозорий": "#E8EEF2", "коричневий": "#5C3B28", "синій": "#2F4C8C",
};
export function swatch(name: string) {
  const parts = name.split(/\s*[+,/]\s*/).map((p) => p.trim().toLowerCase());
  const c = parts.map((p) => COLOR_HEX[p] ?? COLOR_HEX[p.split(" ")[0]] ?? "#777");
  return c.length > 1 ? `linear-gradient(135deg,${c[0]} 50%,${c[1]} 50%)` : c[0];
}
export const FAMILIES: { id: string; name: string; sw: string; test: (c: string) => boolean }[] = [
  { id: "white", name: "Білий", sw: "#F4F4F2", test: (c) => /біл/.test(c) },
  { id: "black", name: "Чорний", sw: "#141414", test: (c) => /чорн/.test(c) },
  { id: "chrome", name: "Хром і срібло", sw: "#C9CBD0", test: (c) => /хром|срібн|нікел/.test(c) },
  { id: "gold", name: "Латунь і золото", sw: "#C9A35A", test: (c) => /латун|золот|мід|бронз/.test(c) },
  { id: "graph", name: "Графіт і сірий", sw: "#4A4A4E", test: (c) => /графіт|сір|титан/.test(c) },
  { id: "color", name: "Кольорові", sw: "linear-gradient(135deg,#C7782F 50%,#3F6E52 50%)", test: (c) => /бурштин|зелен|червон|кавов|рожев|син|коричн/.test(c) },
];

export const fmt = (n: number | null | undefined) => (n == null ? "" : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "));
export function plural(n: number, f: [string, string, string]) {
  const a = n % 10, b = n % 100;
  return a === 1 && b !== 11 ? f[0] : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? f[1] : f[2];
}

/** Фото кожного кольору моделі — для крапок на картках. */
export function getColorPhotos(kind: string): Promise<Record<string, Record<string, string>>> { return memo("photos:" + kind, () => loadColorPhotos(kind)); }
async function loadColorPhotos(kind: string): Promise<Record<string, Record<string, string>>> {
  const out: Record<string, Record<string, string>> = {};
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("variants").select("model_code,color,photo,models!inner(kind_code)")
      .eq("models.kind_code", kind).eq("is_active", true).not("photo", "is", null).range(from, from + 999);
    if (error) throw error;
    for (const v of (data ?? []) as { model_code: string; color: string | null; photo: string }[]) {
      if (!v.color) continue;
      (out[v.model_code] ??= {})[v.color] ??= v.photo;
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Фото для карток: у LineF є готова зменшена копія 480 px (~95 КБ замість ~290 КБ оригіналу). */
export function cardPhoto(u: string | null | undefined): string | null {
  if (!u) return null;
  return u.includes("linef.com.ua/uploads/products/original/") ? u.replace("/original/", "/middle/") : u;
}
