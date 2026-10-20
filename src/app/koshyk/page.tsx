"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { readCart, writeCart, type CartItem } from "@/lib/cart";
import { fmt } from "@/lib/catalog";

export default function CartPage() {
  const [items, setItems] = useState<CartItem[] | null>(null);
  useEffect(() => setItems(readCart()), []);
  const upd = (next: CartItem[]) => { setItems(next); writeCart(next); };
  const total = (items ?? []).reduce((s, i) => s + (i.price ?? 0) * i.qty, 0);
  return (
    <main className="wrap section">
      <div className="page-head"><h1>Кошик</h1></div>
      {items === null ? null : items.length === 0 ? (
        <div className="empty-note">Кошик порожній. <Link href="/katalog" style={{ color: "var(--sp-warm)" }}>Перейти до каталогу</Link></div>
      ) : (
        <>
          <div className="cartlist">
            {items.map((it) => (
              <div key={it.sku} className="cartrow">
                <div className="ph">{it.photo && <img src={it.photo} alt="" />}</div>
                <div style={{ minWidth: 0 }}>
                  <Link href={`/p/${it.code.toLowerCase()}`} style={{ textDecoration: "none" }}>{it.title}</Link>
                  <div className="mute" style={{ fontSize: 13 }}>{it.sku}{it.variant ? ` · ${it.variant}` : ""}</div>
                  <div className="qty" style={{ marginTop: 8 }}>
                    <button type="button" aria-label="Менше" onClick={() => upd(items.map((x) => x.sku === it.sku ? { ...x, qty: Math.max(1, x.qty - 1) } : x))}>−</button>
                    <span className="dotnum">{it.qty}</span>
                    <button type="button" aria-label="Більше" onClick={() => upd(items.map((x) => x.sku === it.sku ? { ...x, qty: x.qty + 1 } : x))}>+</button>
                    <button type="button" aria-label="Видалити" onClick={() => upd(items.filter((x) => x.sku !== it.sku))} style={{ width: "auto", padding: "0 12px" }}>Видалити</button>
                  </div>
                </div>
                <div className="price">{it.price != null ? <>{fmt(it.price * it.qty)}<small>₴</small></> : <span className="from">за запитом</span>}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginTop: 28 }}>
            <div className="bigprice">{fmt(total)}<small>₴</small></div>
            <button type="button" className="btn btn-main" disabled title="Оформлення — наступний етап">Оформити замовлення (скоро)</button>
          </div>
        </>
      )}
    </main>
  );
}
