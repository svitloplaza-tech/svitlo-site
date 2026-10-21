import type { Metadata } from "next";
import Link from "next/link";
import Checkout from "@/components/Checkout";
import { getSetting } from "@/lib/catalog";

export const metadata: Metadata = { title: "Кошик і оформлення замовлення" };
export const revalidate = 600;

export default async function CartPage() {
  const [pay, showroom] = await Promise.all([
    getSetting<{ mono: boolean; cod: boolean; iban: boolean }>("payments"),
    getSetting<{ address: string | null }>("showroom"),
  ]);
  return (
    <main className="wrap section">
      <div className="crumbs"><Link href="/">Головна</Link><span>/</span><span>Кошик</span></div>
      <div className="page-head"><h1>Оформлення <span className="mute">замовлення</span></h1></div>
      <Checkout pay={pay ?? { mono: false, cod: true, iban: true }} showroom={showroom?.address ?? null} />
    </main>
  );
}
