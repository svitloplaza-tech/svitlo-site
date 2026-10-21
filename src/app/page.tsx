import HomeScenes from "@/components/HomeScenes";
import { HOME_HTML } from "@/components/home/markup";
import { fmt, getKinds, getSeriesNames, getTotals } from "@/lib/catalog";
import { db } from "@/lib/supabase";

export const revalidate = 3600; // оновлення даних каталогу щогодини

export default async function Home() {
  const [t, kinds, series, hero] = await Promise.all([getTotals(), getKinds(), getSeriesNames(),
    db.from("catalog_models").select("price_from").eq("code", "SP-P1228").maybeSingle()]);
  const kindLinks = kinds.filter((k) => k.count > 0).map((k) => `<a href="/katalog/${k.slug}"><b>${k.code}</b><span>${k.name_plural}</span><small>${k.count}</small></a>`).join("");
  const types = kinds.filter((k) => k.count > 0)
    .map((k) => `<a class="t rv" href="/katalog/${k.slug}"><b class="dotnum">${k.code}</b><span>${k.name_plural}</span></a>`).join("");
  // три рухомі рядки з назв серій: рівномірна вибірка, кожна назва — посилання на свою серію
  const pick = series.filter((_, i) => i % Math.max(1, Math.floor(series.length / 33)) === 0).slice(0, 33);
  const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const rowsHtml = [0, 1, 2].map((r) => `<div>${pick.filter((_, i) => i % 3 === r)
    .map((x) => `<a href="/seriya/${x.id.toLowerCase()}">${esc(x.name)}</a>`).join("<i>·</i>")}</div>`).join("");
  const html = HOME_HTML.replace("{{SERIES}}", rowsHtml).replace("{{TYPES}}", types)
    .replace("{{PRICE}}", fmt(hero.data?.price_from ?? null) || "—").replace("{{KINDS}}", kindLinks)
    .replace("{{S}}", String(t.series)).replace("{{SF}}", fmt(t.series))
    .replace("{{M}}", String(t.models)).replace("{{MF}}", fmt(t.models))
    .replace("{{V}}", String(t.variants)).replace("{{VF}}", fmt(t.variants));
  return <main><HomeScenes html={html} /></main>;
}
