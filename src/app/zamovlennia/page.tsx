import type { Metadata } from "next";
import Link from "next/link";
import PayAgain from "@/components/PayAgain";
import { fmt } from "@/lib/catalog";
import { db } from "@/lib/supabase";

export const metadata: Metadata = { title: "Дякуємо за замовлення", robots: { index: false } };
export const dynamic = "force-dynamic";
type O = { number: number; status: string; payment_method: string; payment_status: string; total: number; first_name: string;
  delivery: { name?: string; city?: string; warehouse?: string; street?: string; house?: string; address?: string };
  items: { sku: string; title: string; variant: string | null; qty: number; price: number }[] };

export default async function Thanks({ searchParams }: { searchParams: Promise<{ n?: string; t?: string }> }) {
  const { n, t } = await searchParams;
  const ok = /^\d+$/.test(n ?? "") && /^[0-9a-f-]{36}$/.test(t ?? "");
  const { data } = ok ? await db.rpc("order_status", { p_number: Number(n), p_token: t }) : { data: null };
  const o = data as O | null;
  if (!o) return <main className="wrap section"><div className="page-head"><h1>Замовлення не знайдено</h1></div><p className="mute">Перевірте посилання або зателефонуйте нам.</p></main>;
  const paid = o.payment_status === "paid";
  const d = o.delivery ?? {};
  return (
    <main className="wrap section thanks">
      <span className="chip"><b className="dotnum">{o.number}</b><span>Замовлення</span></span>
      <h1>Дякуємо, {o.first_name}! <span className="mute">{paid ? "Оплату отримано." : "Замовлення прийнято."}</span></h1>
      <p className="mute">Менеджер зателефонує найближчим часом, щоб підтвердити наявність і доставку.
        {o.payment_method === "iban" && " Реквізити для оплати надішлемо після підтвердження."}
        {o.payment_method === "cod" && " Оплата — при отриманні у відділенні Нової Пошти."}</p>
      {o.payment_method === "mono" && !paid && <PayAgain number={o.number} token={t!} status={o.payment_status} />}
      <div className="thanks-box">
        {o.items.map((i) => <div key={i.sku} className="thanks-row"><span>{i.title}<small>{i.sku}{i.variant ? ` · ${i.variant}` : ""} × {i.qty}</small></span><b>{fmt(i.price * i.qty)} ₴</b></div>)}
        <div className="thanks-row tot"><span>Разом</span><b className="dotnum">{fmt(o.total)} ₴</b></div>
        <div className="thanks-row"><span>Доставка<small>{[d.name, d.city, d.warehouse, d.street && `${d.street}, ${d.house}`, d.address].filter(Boolean).join(" · ")}</small></span></div>
      </div>
      <div className="cta-row" style={{ display: "flex", gap: 12, marginTop: 28 }}><Link className="btn btn-main" href="/katalog">Продовжити покупки</Link></div>
    </main>
  );
}
