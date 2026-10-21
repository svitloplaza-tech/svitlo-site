"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cartCount, readCart } from "@/lib/cart";

const KINDS = [
  ["L", "Люстри", "lyustry"], ["P", "Підвісні", "pidvisni"], ["W", "Бра", "bra"], ["C", "Стельові", "stelovi"],
  ["T", "Настільні", "nastilni"], ["F", "Торшери", "torshery"], ["O", "Вуличні", "vulychni"],
];

const NAV = [
  { href: "/katalog", label: "Каталог" },
  { href: "/shourum", label: "Шоурум" },
  { href: "/3d-tur", label: "3D-тур" },
  { href: "/sotsmerezhi", label: "Ми в соцмережах" },
];

export default function Header() {
  // iOS вмикає :active (підсвітку при дотику) лише якщо є слухач touchstart
  useEffect(() => { const f = () => {}; document.addEventListener("touchstart", f, { passive: true }); return () => document.removeEventListener("touchstart", f); }, []);
  const path = usePathname();
  const router = useRouter();
  const [n, setN] = useState(0);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  // закриваємо меню при переході на іншу сторінку; блокуємо прокрутку під відкритим меню
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    document.documentElement.classList.toggle("menu-open", open);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => {
    const upd = () => setN(cartCount(readCart()));
    upd();
    window.addEventListener("sp-cart", upd);
    window.addEventListener("storage", upd);
    return () => { window.removeEventListener("sp-cart", upd); window.removeEventListener("storage", upd); };
  }, []);
  return (
    <>
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
        <button type="button" className="burger" aria-label={open ? "Закрити меню" : "Відкрити меню"} aria-expanded={open} aria-controls="mmenu" onClick={() => setOpen(!open)}>
          <i /><i />
        </button>
      </div>
    </header>
    {/* меню поза header: у header є backdrop-filter, який ламає position:fixed для вкладених елементів */}
      <div id="mmenu" className={`mmenu${open ? " open" : ""}`} hidden={!open}>
        <div className="wrap">
          <nav className="mm-main" aria-label="Мобільне меню">
            {NAV.map((l) => <Link key={l.href} href={l.href} onClick={() => setOpen(false)} aria-current={path?.startsWith(l.href) ? "page" : undefined}>{l.label}</Link>)}
            <Link href="/koshyk" onClick={() => setOpen(false)}>Кошик{n ? ` · ${n}` : ""}</Link>
          </nav>
          <div className="mm-kinds">
            <h4>Каталог</h4>
            {KINDS.map(([c, name, slug]) => <Link key={c} href={`/katalog/${slug}`} onClick={() => setOpen(false)}><b>{c}</b>{name}</Link>)}
            <Link className="allser" href="/katalog/kolektsii" onClick={() => setOpen(false)}><b>K</b>Колекції</Link>
          </div>
        </div>
      </div>
    </>
  );
}
