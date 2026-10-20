import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import CatalogFilters from "@/components/CatalogFilters";
import ModelCard from "@/components/ModelCard";
import { FAMILIES, getCatalogByKind, getColorPhotos, getKinds, plural } from "@/lib/catalog";

export const revalidate = 3600; // оновлення даних каталогу щогодини
const PER = 48;
type Props = { params: Promise<{ type: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type } = await params;
  const k = (await getKinds()).find((x) => x.slug === type);
  return k ? { title: `${k.name_plural} світильники`, description: `${k.name_plural} у каталозі Svitlo Plaza: ціни, наявність, доставка Новою Поштою.` } : {};
}

export default async function KindPage({ params, searchParams }: Props) {
  const { type } = await params; const sp = await searchParams;
  const kinds = await getKinds();
  const kind = kinds.find((k) => k.slug === type);
  if (!kind) notFound();
  const [all, photos] = await Promise.all([getCatalogByKind(kind.code), getColorPhotos(kind.code)]);

  const fam = (sp.kolir ?? "").split(",").filter(Boolean);
  const tests = FAMILIES.filter((f) => fam.includes(f.id)).map((f) => f.test);
  let list = all.filter((m) => (!tests.length || (m.colors ?? []).some((c) => tests.some((t) => t(c)))) && (sp.nayavnist !== "1" || m.in_stock));
  if (sp.sort === "asc") list = [...list].sort((a, b) => (a.price_from ?? 1e9) - (b.price_from ?? 1e9));
  if (sp.sort === "desc") list = [...list].sort((a, b) => (b.price_from ?? 0) - (a.price_from ?? 0));
  const pages = Math.max(1, Math.ceil(list.length / PER));
  const page = Math.min(pages, Math.max(1, Number(sp.page) || 1));
  const shown = list.slice((page - 1) * PER, page * PER);
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]);
    if (p > 1) q.set("page", String(p));
    return `/katalog/${type}${q.toString() ? `?${q}` : ""}`;
  };
  const [first, ...rest] = kind.name_plural.split(" ");

  return (
    <main>
      <div className="wrap">
        <div className="crumbs"><Link href="/">Головна</Link><span>/</span><Link href="/katalog">Каталог</Link><span>/</span><span>{kind.name_plural}</span></div>
        <div className="head"><div style={{ display: "grid", gap: 12 }}>
          <h1>{first} <span className="mute">{rest.join(" ") || "світильники"}</span></h1>
          <p>{all.length} {plural(all.length, ["модель", "моделі", "моделей"])} у каталозі</p>
        </div></div>
        <nav className="types" aria-label="Типи світильників">
          {kinds.filter((k) => k.count > 0).map((k) => (
            <Link key={k.code} className="type" href={`/katalog/${k.slug}`} aria-current={k.code === kind.code ? "page" : undefined}><b>{k.code}</b><span>{k.name_plural}</span></Link>
          ))}
        </nav>
      </div>
      <Suspense><CatalogFilters /></Suspense>
      <div className="wrap">
        <div className="count">{list.length ? `Знайдено: ${list.length} ${plural(list.length, ["модель", "моделі", "моделей"])}` : ""}</div>
        <div className="grid">
          {shown.length ? shown.map((m, i) => <ModelCard key={m.code} m={m} i={i} photos={photos[m.code]} />)
            : <div className="empty">За цими фільтрами нічого немає. Зніміть один із фільтрів.</div>}
        </div>
        {pages > 1 && (
          <nav className="pager" aria-label="Сторінки">
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => p === page
              ? <span key={p} aria-current="page">{p}</span>
              : <Link key={p} href={href(p)}>{p}</Link>)}
          </nav>
        )}
      </div>
    </main>
  );
}
