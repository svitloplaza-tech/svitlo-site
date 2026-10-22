import Link from "next/link";
import type { ReactNode } from "react";
import { getSetting } from "@/lib/catalog";

// Сторінки «Покупцям» (оплата, доставка, повернення, конфіденційність). Посилання — у футері.
export const INFO = [
  { href: "/oplata", label: "Способи оплати" },
  { href: "/dostavka", label: "Доставка" },
  { href: "/povernennia", label: "Повернення товару та коштів" },
  { href: "/konfidentsiinist", label: "Політика конфіденційності" },
];

export const CONTACT_EMAIL = "svitloplaza@gmail.com";
export type Showroom = { address: string | null; hours: string | null; phone: string | null };
export const getShowroom = () => getSetting<Showroom>("showroom");

export function Contacts({ s }: { s: Showroom | null }) {
  return (
    <ul>
      {s?.phone && <li>Телефон: <a href={`tel:${s.phone.replace(/[^+\d]/g, "")}`}>{s.phone}</a></li>}
      <li>Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></li>
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
