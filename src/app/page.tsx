import HomeScenes from "@/components/HomeScenes";
import { HOME_HTML } from "@/components/home/markup";
import { fmt, getKinds, getTotals } from "@/lib/catalog";

export const revalidate = 3600; // оновлення даних каталогу щогодини

export default async function Home() {
  const [t, kinds] = await Promise.all([getTotals(), getKinds()]);
  const types = kinds.filter((k) => k.count > 0)
    .map((k) => `<a class="t rv" href="/katalog/${k.slug}"><b class="dotnum">${k.code}</b><span>${k.name_plural}</span></a>`).join("");
  const html = HOME_HTML.replace("{{TYPES}}", types)
    .replace("{{S}}", String(t.series)).replace("{{SF}}", fmt(t.series))
    .replace("{{M}}", String(t.models)).replace("{{MF}}", fmt(t.models))
    .replace("{{V}}", String(t.variants)).replace("{{VF}}", fmt(t.variants));
  return <main><HomeScenes html={html} /></main>;
}
