import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ModelCard from "@/components/ModelCard";
import ProductView from "@/components/ProductView";
import { getKinds, getModel } from "@/lib/catalog";

export const revalidate = 3600; // оновлення даних каталогу щогодини
type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const d = await getModel(code);
  if (!d) return {};
  return { title: `${d.model.title} ${d.model.code}`, description: d.model.description ?? undefined,
    openGraph: { images: d.model.photo ? [d.model.photo] : undefined } };
}

/** Адреса /p/{код} — та сама, що в QR-кодах PDF-каталогу. */
export default async function ProductPage({ params }: Props) {
  const { code } = await params;
  const d = await getModel(code);
  if (!d) notFound();
  const kind = (await getKinds()).find((k) => k.code === d.model.kind_code);
  const seriesName = d.series?.name as string | null;
  return (
    <main>
      <div className="wrap">
        <div className="crumbs" style={{ paddingTop: 28 }}>
          <Link href="/katalog">Каталог</Link><span>/</span>
          {kind && <><Link href={`/katalog/${kind.slug}`}>{kind.name_plural}</Link><span>/</span></>}
          {seriesName && <><Link href={`/seriya/${d.model.series_id.toLowerCase()}`}>{seriesName}</Link><span>/</span></>}
          <span>{d.model.code}</span>
        </div>
        <ProductView model={d.model} variants={d.variants} />
      </div>
      {d.siblings.length > 0 && (
        <section className="more"><div className="wrap">
          <h2>Інші моделі <span className="mute">серії {seriesName}</span></h2>
          <div className="grid">{d.siblings.map((m, i) => <ModelCard key={m.code} m={m} i={i} />)}</div>
        </div></section>
      )}
    </main>
  );
}
