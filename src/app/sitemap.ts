import type { MetadataRoute } from "next";
import { db } from "@/lib/supabase";
import { getKinds } from "@/lib/catalog";

// Карта сайту для Google: /sitemap.xml. Товари й серії — з бази, оновлення щогодини.
export const revalidate = 3600;
const BASE = "https://www.svitloplaza.store";

async function allModels() {
  const out: { slug: string; series_id: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("catalog_models").select("slug,series_id").order("code").range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as { slug: string; series_id: string }[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [kinds, models] = await Promise.all([getKinds(), allModels()]);
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
    ...models.map((m) => page(`/p/${m.slug}`, 0.8)),
  ];
}
