import Link from "next/link";
import type { Metadata } from "next";
import ModelCard from "@/components/ModelCard";
import { plural, search } from "@/lib/catalog";

export const metadata: Metadata = { title: "Пошук", robots: { index: false } };
type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const q = (await searchParams).q ?? "";
  const res = await search(q);
  return (
    <main className="wrap section">
      <div className="crumbs"><Link href="/katalog">Каталог</Link><span>/</span><span>Пошук</span></div>
      <div className="page-head">
        <h1>Пошук <span className="mute">«{q}»</span></h1>
        <p>{res.length ? `Знайдено: ${res.length} ${plural(res.length, ["модель", "моделі", "моделей"])}${res.length === 60 ? " (перші 60)" : ""}` : "Нічого не знайдено. Спробуйте код моделі, наприклад SP-P1228, або назву серії."}</p>
      </div>
      <div className="grid">{res.map((m, i) => <ModelCard key={m.code} m={m} i={i} />)}</div>
    </main>
  );
}
