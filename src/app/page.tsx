import HomeScenes from "@/components/HomeScenes";
import { HOME_HTML } from "@/components/home/markup";
import { cardPhoto, fmt, getKinds, getNew, getSeriesNames, getTotals } from "@/lib/catalog";
import { db } from "@/lib/supabase";
import type { Metadata } from "next";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export const revalidate = 3600; // оновлення даних каталогу щогодини

export default async function Home() {
  const [t, kinds, series, hero, fresh] = await Promise.all([getTotals(), getKinds(), getSeriesNames(),
    db.from("catalog_models").select("price_from").eq("code", "SP-P1228").maybeSingle(), getNew(12).catch(() => [])]);
  const kindLinks = kinds.filter((k) => k.count > 0).map((k) => `<a href="/katalog/${k.slug}"><b>${k.code}</b><span>${k.name_plural}</span><small>${k.count}</small></a>`).join("");
  const types = kinds.filter((k) => k.count > 0)
    .map((k) => `<a class="t rv" href="/katalog/${k.slug}"><b class="dotnum">${k.code}</b><span>${k.name_plural}</span></a>`).join("")
    + `<a class="t rv allser" href="/katalog/kolektsii"><b class="dotnum">K</b><span>Колекції</span></a>`;
  // три рухомі рядки з назв серій: рівномірна вибірка, кожна назва — посилання на свою серію
  const withImg = series.filter((x) => x.img);
  const pick = withImg.filter((_, i) => i % Math.max(1, Math.floor(withImg.length / 33)) === 0).slice(0, 33);
  const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const rowsHtml = [0, 1, 2].map((r) => `<div>${pick.filter((_, i) => i % 3 === r)
    .map((x) => `<a href="/seriya/${x.id.toLowerCase()}"><img src="${esc(x.img!)}" alt="" loading="lazy" decoding="async"><span>${esc(x.name)}</span></a>`).join("<i>·</i>")}</div>`).join("");
  // «Новинки в шоурумі» (models.arrived_at): один ряд назв, як у серій; рух — від прокрутки сторінки, далі стрілками.
  // Під назвою, що підходить до центру екрана, проявляється фото товару. Немає новинок — секції немає.
  const newCards = fresh.map((m) => {
    const ph = cardPhoto(m.photo) ?? m.photo;
    const price = m.price_from != null ? `${m.variants_count > 1 ? "від " : ""}${fmt(m.price_from)} ₴` : "ціна за запитом";
    return `<a class="nr" href="/p/${esc(m.slug)}" draggable="false">${ph ? `<img src="${esc(ph)}" alt="${esc(m.title)}" loading="lazy" decoding="async" draggable="false">` : ""}<small class="nm">${esc(m.title)} · ${price}</small></a>`;
  }).join("");
  const newHtml = fresh.length ? `<section class="novi" id="novynky"><div class="wrap"><div class="novi-head rv"><div><span class="chip"><b>03</b><span>Новинки в шоурумі</span></span>
<h2>Щойно привезли <span class="mute">— дивіться наживо</span></h2></div><div class="novi-nav"><button type="button" class="nw-btn" data-d="-1" aria-label="Попередні">‹</button><button type="button" class="nw-btn" data-d="1" aria-label="Наступні">›</button></div></div></div>
<nav class="nrow" aria-label="Новинки"><div class="nw-track">${newCards}</div></nav><div class="wrap"><div class="cta-row rv"><a class="btn btn-main" href="/novynky">Усі новинки →</a><a class="btn btn-sec" href="/shourum">Адреса шоуруму</a></div></div></section>` : "";
  const html = HOME_HTML.replace("{{NEW}}", newHtml).replace("{{TN}}", fresh.length ? "04" : "03").replace("{{SERIES}}", rowsHtml).replace("{{TYPES}}", types)
    .replace("{{PRICE}}", fmt(hero.data?.price_from ?? null) || "—").replace("{{KINDS}}", kindLinks)
    .replace("{{S}}", String(t.series)).replace("{{SF}}", fmt(t.series))
    .replace("{{M}}", String(t.models)).replace("{{MF}}", fmt(t.models))
    .replace("{{V}}", String(t.variants)).replace("{{VF}}", fmt(t.variants));
  return <main><HomeScenes html={html} /></main>;
}
