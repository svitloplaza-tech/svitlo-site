import Link from "next/link";
import type { Metadata } from "next";
import { getSetting } from "@/lib/catalog";

export const revalidate = 3600; // оновлення даних каталогу щогодини
export const metadata: Metadata = { title: "Шоурум і контакти" };
type Showroom = { address: string | null; hours: string | null; phone: string | null };

export default async function Showroom() {
  const s = await getSetting<Showroom>("showroom");
  return (
    <main className="wrap section">
      <div className="crumbs"><Link href="/">Головна</Link><span>/</span><span>Шоурум</span></div>
      <div className="page-head">
        <h1>Шоурум <span className="mute">і контакти</span></h1>
        <p>Приходьте подивитися світильники наживо: увімкнемо, порівняємо температуру світла й підберемо під ваш інтер'єр.</p>
      </div>
      <div className="notes" style={{ maxWidth: 820 }}>
        <div><b>Адреса</b>{s?.address ?? "Уточнюється"}</div>
        <div><b>Години роботи</b>{s?.hours ?? "Уточнюються"}</div>
        <div><b>Телефон</b>{s?.phone ?? "Уточнюється"}</div>
      </div>
      <div className="cta" style={{ marginTop: 32 }}><Link className="btn btn-sec" href="/3d-tur">3D-тур шоурумом</Link></div>
    </main>
  );
}
