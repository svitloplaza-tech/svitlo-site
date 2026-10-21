import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ModelCard from "@/components/ModelCard";
import { db } from "@/lib/supabase";
import { plural, type CatalogModel } from "@/lib/catalog";

export const revalidate = 43200; // сторінка кешується (KV) і оновлюється раз на 12 год
export const generateStaticParams = async () => []; // генерується при першому відкритті
type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  const sid = id.toUpperCase();
  const { data: s } = await db.from("series").select("*").eq("id", sid).maybeSingle();
  if (!s) return null;
  const { data } = await db.from("catalog_models").select("*").eq("series_id", sid).order("sort");
  return { s, models: (data ?? []) as CatalogModel[] };
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await load((await params).id);
  return d ? { title: `Серія ${d.s.name ?? d.s.id}` } : {};
}
export default async function SeriesPage({ params }: Props) {
  const d = await load((await params).id);
  if (!d) notFound();
  return (
    <main className="wrap section">
      <div className="crumbs"><Link href="/katalog">Каталог</Link><span>/</span><span>{d.s.name ?? d.s.id}</span></div>
      <div className="page-head">
        <span className="chip"><b>{d.s.id}</b><span>Серія</span></span>
        <h1>{d.s.name ?? d.s.id} <span className="mute">{d.models.length} {plural(d.models.length, ["модель", "моделі", "моделей"])}</span></h1>
      </div>
      <div className="grid">{d.models.map((m, i) => <ModelCard key={m.code} m={m} i={i} />)}</div>
    </main>
  );
}
