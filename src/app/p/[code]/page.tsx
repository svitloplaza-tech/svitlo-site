import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ModelCard from "@/components/ModelCard";
import ProductView from "@/components/ProductView";
import { getKinds, getModel } from "@/lib/catalog";
import { describeModel, type DModel, type DSeries, type DVariant } from "@/lib/describe";

const texts = (d: NonNullable<Awaited<ReturnType<typeof getModel>>>) =>
  describeModel(d.model as unknown as DModel, d.variants as unknown as DVariant[], d.series as unknown as DSeries);

export const revalidate = 3600; // сторінка рендериться на запит (ISR для динамічних адрес в OpenNext вважає кеш застарілим щосекунди й писав би в KV на кожен перегляд); дані — з кешу в пам'яті
type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const d = await getModel(code);
  if (!d) return {};
  const t = texts(d);
  return { title: t.title, description: t.desc, alternates: { canonical: `/p/${d.model.slug}` },
    openGraph: { images: d.model.photo ? [d.model.photo] : undefined } };
}

/** Адреса /p/{код} — та сама, що в QR-кодах PDF-каталогу. */
export default async function ProductPage({ params }: Props) {
  const { code } = await params;
  const d = await getModel(code);
  if (!d) notFound();
  const kind = (await getKinds()).find((k) => k.code === d.model.kind_code);
  const seriesName = d.series?.name as string | null;
  const t = texts(d);
  const prices = d.variants.map((v) => v.price).filter((p): p is number => !!p);
  const ld = { "@context": "https://schema.org", "@type": "Product", name: d.model.title, sku: d.model.code, description: t.desc,
    image: d.model.photo ? [d.model.photo] : undefined, brand: { "@type": "Brand", name: "Svitlo Plaza" },
    offers: prices.length ? { "@type": "AggregateOffer", priceCurrency: "UAH", lowPrice: Math.min(...prices), highPrice: Math.max(...prices),
      offerCount: d.variants.length, availability: d.variants.some((v) => v.in_stock) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `https://www.svitloplaza.store/p/${d.model.slug}` } : undefined };
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
        <section className="about"><h2>Опис</h2>{t.body.map((p, i) => <p key={i}>{p}</p>)}</section>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      {d.siblings.length > 0 && (
        <section className="more"><div className="wrap">
          <h2>Інші моделі <span className="mute">серії {seriesName}</span></h2>
          <div className="grid">{d.siblings.map((m, i) => <ModelCard key={m.code} m={m} i={i} />)}</div>
        </div></section>
      )}
    </main>
  );
}
