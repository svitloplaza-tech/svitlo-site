import Link from "next/link";
import type { Metadata } from "next";
import { getKinds, getTotals, fmt, plural } from "@/lib/catalog";

export const revalidate = 3600; // оновлення даних каталогу щогодини
export const metadata: Metadata = { title: "Каталог світильників", description: "Люстри, підвісні, бра, стельові, настільні, торшери й вуличне світло Svitlo Plaza." };

export default async function Catalog() {
  const [kinds, t] = await Promise.all([getKinds(), getTotals()]);
  return (
    <main className="wrap section">
      <div className="crumbs"><Link href="/">Головна</Link><span>/</span><span>Каталог</span></div>
      <div className="page-head">
        <h1>Каталог <span className="mute">Svitlo Plaza</span></h1>
        <p>{fmt(t.series)} серій, {fmt(t.models)} {plural(t.models, ["модель", "моделі", "моделей"])} і {fmt(t.variants)} варіантів за кольором і розміром.</p>
      </div>
      <div className="kindgrid">
        {kinds.filter((k) => k.count > 0).map((k) => (
          <Link key={k.code} className="kindcard" href={`/katalog/${k.slug}`}>
            <b>{k.code}</b><div><span>{k.name_plural}</span><br /><small>{fmt(k.count)} {plural(k.count, ["модель", "моделі", "моделей"])}</small></div>
          </Link>
        ))}
      </div>
    </main>
  );
}
