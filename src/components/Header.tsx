"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cartCount, readCart } from "@/lib/cart";

const NAV = [
  { href: "/katalog", label: "Каталог" },
  { href: "/shourum", label: "Шоурум" },
  { href: "/3d-tur", label: "3D-тур" },
  { href: "/sotsmerezhi", label: "Ми в соцмережах" },
];

export default function Header() {
  const path = usePathname();
  const router = useRouter();
  const [n, setN] = useState(0);
  const [q, setQ] = useState("");
  useEffect(() => {
    const upd = () => setN(cartCount(readCart()));
    upd();
    window.addEventListener("sp-cart", upd);
    window.addEventListener("storage", upd);
    return () => { window.removeEventListener("sp-cart", upd); window.removeEventListener("storage", upd); };
  }, []);
  return (
    <header>
      <div className="wrap">
        <Link className="logo" href="/">Svitlo <i>●</i> Plaza</Link>
        <nav className="main" aria-label="Головне меню">
          {NAV.map((l) => (
            <Link key={l.href} href={l.href} aria-current={path?.startsWith(l.href) ? "page" : undefined}>{l.label}</Link>
          ))}
        </nav>
        <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/poshuk?q=${encodeURIComponent(q.trim())}`); }}>
          <span aria-hidden="true">⌕</span>
          <input id="q" type="search" placeholder="Назва або код" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Пошук у каталозі" />
        </form>
        <Link className="cart" href="/koshyk"><span>Кошик</span> <b aria-label="товарів у кошику">{n}</b></Link>
      </div>
    </header>
  );
}
