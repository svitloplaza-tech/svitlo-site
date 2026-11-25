import Link from "next/link";
import type { Metadata } from "next";
import ModelCard from "@/components/ModelCard";
import { getNew, plural, type CatalogModel } from "@/lib/catalog";

// «Новинки в шоурумі»: моделі з датою надходження (models.arrived_at), згруповані за датою, найновіші вгорі.
export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Новинки в шоурумі",
  description: "Нові світильники, що щойно надійшли в шоурум Svitlo Plaza у Черкасах: бра, підвіси, люстри й вуличне світло. Можна подивитися наживо або замовити з доставкою.",
  alternates: { canonical: "/novynky" },
};

const MONTHS = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];
const day = (d: string) => { const [y, m, dd] = d.split("-").map(Number); return `${dd} ${MONTHS[m - 1]} ${y}`; };

export default async function NewPage() {
  const all = await getNew();
  const groups: [string, CatalogModel[]][] = [];
  for (const m of all) {
    const d = m.arrived_at as string;
    const g = groups.find((x) => x[0] === d);
    if (g) g[1].push(m); else groups.push([d, [m]]);
  }
  return (
    <main>
      <div className="wrap">
        <div className="crumbs"><Link href="/">Головна</Link><span>/</span><span>Новинки</span></div>
        <div className="head"><div style={{ display: "grid", gap: 12 }}>
          <h1>Новинки <span className="mute">в шоурумі</span></h1>
          <p>Світильники, що щойно надійшли в шоурум у Черкасах. Приходьте подивитися наживо — або замовляйте з доставкою по Україні.</p>
        </div></div>
        {groups.length ? groups.map(([d, list]) => (
          <section key={d} className="newgroup">
            <h2>Надійшло {day(d)} <span className="mute">· {list.length} {plural(list.length, ["модель", "моделі", "моделей"])}</span></h2>
            <div className="grid">{list.map((m, i) => <ModelCard key={m.code} m={m} i={i} />)}</div>
          </section>
        )) : <div className="empty">Скоро тут з'являться новинки.</div>}
        <div className="cta" style={{ margin: "40px 0 64px", display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="btn btn-main" href="/shourum">Адреса шоуруму</Link>
          <Link className="btn btn-sec" href="/katalog">Увесь каталог</Link>
        </div>
      </div>
    </main>
  );
}
