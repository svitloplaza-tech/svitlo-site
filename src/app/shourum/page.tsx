import Link from "next/link";
import type { Metadata } from "next";
import { getSetting } from "@/lib/catalog";
import { GEO, MAPS_DIR, MAPS_URL, PHONE, STORE_LD } from "@/components/InfoPage";

export const revalidate = 3600; // оновлення даних каталогу щогодини
export const metadata: Metadata = {
  title: "Шоурум і контакти",
  description: "Шоурум світильників Svitlo Plaza у Черкасах, вул. Кривалівська, 38: адреса на мапі, години роботи, телефон, маршрут і відгуки в Google.",
  alternates: { canonical: "/shourum" },
};
type Showroom = { address: string | null; hours: string | null; phone: string | null };

export default async function Showroom() {
  const s = await getSetting<Showroom>("showroom");
  const phone = s?.phone ?? PHONE;
  return (
    <main className="wrap section">
      <div className="crumbs"><Link href="/">Головна</Link><span>/</span><span>Шоурум</span></div>
      <div className="page-head">
        <h1>Шоурум <span className="mute">і контакти</span></h1>
        <p>Приходьте подивитися світильники наживо: увімкнемо, порівняємо температуру світла й підберемо під ваш інтер'єр.</p>
      </div>
      <div className="notes" style={{ maxWidth: 820 }}>
        <div><b>Адреса</b>{s?.address ?? "м. Черкаси, вул. Кривалівська, 38"}</div>
        <div><b>Години роботи</b>{s?.hours ?? "Уточнюються"}</div>
        <div><b>Телефон</b><a href={`tel:${phone.replace(/[^+\d]/g, "")}`}>{phone}</a></div>
      </div>
      <div className="cta" style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a className="btn btn-main" href={MAPS_DIR} target="_blank" rel="noopener">Прокласти маршрут</a>
        <a className="btn btn-sec" href={MAPS_URL} target="_blank" rel="noopener">Відгуки в Google</a>
        <Link className="btn btn-sec" href="/3d-tur">3D-тур шоурумом</Link>
      </div>
      <iframe title="Svitlo Plaza на мапі" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
        src={`https://maps.google.com/maps?q=${GEO.lat},${GEO.lng}&z=16&hl=uk&output=embed`}
        style={{ width: "100%", maxWidth: 820, height: 380, border: 0, borderRadius: 16, marginTop: 32, display: "block" }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STORE_LD).replace(/</g, "\\u003c") }} />
    </main>
  );
}
