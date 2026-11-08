import Link from "next/link";
import type { ReactNode } from "react";
import { getSetting } from "@/lib/catalog";

// Сторінки «Покупцям» (оплата, доставка, повернення, конфіденційність). Посилання — у футері.
export const INFO = [
  { href: "/pro-nas", label: "Про нас" },
  { href: "/oplata", label: "Способи оплати" },
  { href: "/dostavka", label: "Доставка" },
  { href: "/povernennia", label: "Повернення товару та коштів" },
  { href: "/konfidentsiinist", label: "Політика конфіденційності" },
];

export const CONTACT_EMAIL = "svitloplaza@gmail.com";
/** Продавець (рішення власника 08.11 — вказувати на сайті для Google Merchant Center). */
export const SELLER = "ФОП Савченко Вадим Іванович";
export const SELLER_ID = "2404208952"; // РНОКПП (витяг ЄДР 27.10.2026)
export const PHONE = "+38 (098) 383-48-22";
export const ADDRESS = "м. Черкаси, вул. Кривалівська, 38";
export type Showroom = { address: string | null; hours: string | null; phone: string | null };
export const getShowroom = () => getSetting<Showroom>("showroom");

export function Contacts({ s }: { s: Showroom | null }) {
  return (
    <ul>
      {s?.phone && <li>Телефон: <a href={`tel:${s.phone.replace(/[^+\d]/g, "")}`}>{s.phone}</a></li>}
      <li>Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></li>
      <li>Продавець: {SELLER}, РНОКПП {SELLER_ID}</li>
      {s?.address && <li>Шоурум: {s.address}{s.hours ? `, ${s.hours}` : ""}</li>}
    </ul>
  );
}

export default function InfoPage({ href, title, lead, updated, children }: { href: string; title: [string, string]; lead: string; updated?: string; children: ReactNode }) {
  const name = INFO.find((i) => i.href === href)?.label ?? title.join(" ");
  return (
    <main className="wrap section">
      <div className="crumbs"><Link href="/">Головна</Link><span>/</span><span>{name}</span></div>
      <div className="page-head">
        <h1>{title[0]} <span className="mute">{title[1]}</span></h1>
        <p>{lead}</p>
      </div>
      <article className="prose">
        {children}
        {updated && <p className="upd">Редакція від {updated}</p>}
      </article>
      <nav className="info-nav" aria-label="Покупцям">
        {INFO.filter((i) => i.href !== href).map((i) => <Link key={i.href} href={i.href}>{i.label} →</Link>)}
      </nav>
    </main>
  );
}
