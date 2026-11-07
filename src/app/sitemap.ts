import type { MetadataRoute } from "next";
import { db } from "@/lib/supabase";
import { getKinds } from "@/lib/catalog";
import { absImg, ownImg } from "@/lib/img";

// Карта сайту для Google: /sitemap.xml. Товари й серії — з бази, оновлення щогодини.
export const revalidate = 3600;
const BASE = "https://www.svitloplaza.store";

/** Власні фото товарів (Storage → /f/…) для карти зображень; фото LineF не додаємо — вони на чужому домені. */
async function ownPhotos() {
  const out = new Map<string, Set<string>>();
  const add = (slug: string, u: string | null) => { if (ownImg(u)) (out.get(slug) ?? out.set(slug, new Set()).get(slug)!).add(absImg(u)!); };
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("variants").select("photo,photos,models!inner(slug,is_active)")
      .eq("is_active", true).eq("models.is_active", true).order("sku").range(from, from + 999);
    if (error) throw error;
    for (const v of (data ?? []) as unknown as { photo: string | null; photos: string[] | null; models: { slug: string } }[]) {
      add(v.models.slug, v.photo); for (const u of v.photos ?? []) add(v.models.slug, u);
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function allModels() {
  const out: { slug: string; series_id: string; photo: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("catalog_models").select("slug,series_id,photo").order("code").range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as { slug: string; series_id: string; photo: string | null }[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [kinds, models, photos] = await Promise.all([getKinds(), allModels(), ownPhotos().catch(() => new Map<string, Set<string>>())]);
  const page = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "weekly") =>
    ({ url: BASE + path, changeFrequency, priority });
  const series = [...new Set(models.map((m) => m.series_id).filter(Boolean))];
  return [
    page("/", 1, "daily"),
    page("/katalog", 0.9, "daily"),
    ...kinds.filter((k) => k.count > 0).map((k) => page(`/katalog/${k.slug}`, 0.9, "daily")),
    page("/katalog/kolektsii", 0.8),
    page("/shourum", 0.6, "monthly"), page("/3d-tur", 0.4, "monthly"), page("/sotsmerezhi", 0.4, "monthly"),
    page("/oplata", 0.4, "yearly"), page("/dostavka", 0.4, "yearly"), page("/povernennia", 0.4, "yearly"), page("/konfidentsiinist", 0.2, "yearly"),
    ...series.map((id) => page(`/seriya/${id.toLowerCase()}`, 0.7)),
    ...models.map((m) => {
      const own = [...(photos.get(m.slug) ?? [])];
      if (ownImg(m.photo)) own.unshift(absImg(m.photo)!);
      const images = [...new Set(own)].slice(0, 10);
      return { ...page(`/p/${m.slug}`, 0.8), ...(images.length ? { images } : {}) };
    }),
  ];
}
