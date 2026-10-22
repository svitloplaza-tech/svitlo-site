import type { MetadataRoute } from "next";
import { headers } from "next/headers";

// /robots.txt. Індексуємо лише основний домен; тестова адреса *.workers.dev закрита, щоб Google не бачив дублікатів.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host") ?? "";
  if (!host.endsWith("svitloplaza.store")) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/koshyk", "/zamovlennia", "/obrane", "/poshuk"] },
    sitemap: "https://www.svitloplaza.store/sitemap.xml",
    host: "https://www.svitloplaza.store",
  };
}
