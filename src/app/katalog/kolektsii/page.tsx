import Link from "next/link";
import type { Metadata } from "next";
import CollectionsReveal from "@/components/CollectionsReveal";
import { fmt, getCollections, getKinds, plural } from "@/lib/catalog";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Колекції світильників", description: "Усі серії Svitlo Plaza: люстри, підвіси, бра й торшери одного дизайну." };
type Props = { searchParams: Promise<{ typ?: string }> };

export default async function Collections({ searchParams }: Props) {
  const { typ } = await searchParams;
  const [all, kinds] = await Promise.all([getCollections(), getKinds()]);
  const kname = new Map(kinds.map((k) => [k.code, k.name_plural]));
  const short = new Map(kinds.map((k) => [k.code, k.name.toLowerCase()]));
  const list = typ ? all.filter((c) => c.kinds.includes(typ)) : all;
  const used = kinds.filter((k) => all.some((c) => c.kinds.includes(k.code)));
  return (
    <main className="wrap section">
      <div className="crumbs"><Link href="/">Головна</Link><span>/</span><Link href="/katalog">Каталог</Link><span>/</span><span>Колекції</span></div>
      <div className="page-head">
        <h1>Колекції <span className="mute">{fmt(all.length)} {plural(all.length, ["серія", "серії", "серій"])}</span></h1>
        <p>Серія — світильники одного дизайну: люстра, підвіс, бра чи торшер, щоб освітити дім в одному стилі.</p>
      </div>
      <nav className="types" aria-label="Тип у серії">
        <Link className="type" href="/katalog/kolektsii" aria-current={!typ ? "page" : undefined}><span>Усі</span></Link>
        {used.map((k) => <Link key={k.code} className="type" href={`/katalog/kolektsii?typ=${k.code}`} aria-current={typ === k.code ? "page" : undefined}><b>{k.code}</b><span>{k.name_plural}</span></Link>)}
      </nav>
      <CollectionsReveal>
        <div className="colgrid">
          {list.map((c) => (
            <Link key={c.id} href={`/seriya/${c.id.toLowerCase()}`} className={`col${c.cover ? "" : " brand"}`}>
              {c.cover ? <img className="col-bg" src={c.cover} alt="" loading="lazy" decoding="async" />
                : <><i className="col-dots" /><i className="col-glow" />
                  <span className="col-tiles">{c.tiles.map((t) => <img key={t} src={t} alt="" loading="lazy" decoding="async" />)}</span></>}
              <span className="col-txt">
                <small>Серія {c.number}{c.own ? " · Колекція Svitlo Plaza" : ""}</small>
                <b>{c.name}</b>
                <em>{c.n} {plural(c.n, ["модель", "моделі", "моделей"])}: {c.kinds.map((k) => short.get(k) ?? kname.get(k) ?? k).join(", ")}</em>
              </span>
            </Link>
          ))}
        </div>
      </CollectionsReveal>
    </main>
  );
}
