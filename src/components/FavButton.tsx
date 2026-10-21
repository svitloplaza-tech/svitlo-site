"use client";
import { useEffect, useState } from "react";
import { isFav, toggleFav, type FavItem } from "@/lib/fav";

/** Сердечко «В обране»: на картці (поверх фото) і на сторінці товару. */
export default function FavButton({ item, big }: { item: FavItem; big?: boolean }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const u = () => setOn(isFav(item.code)); u(); addEventListener("sp-fav", u); addEventListener("storage", u);
    return () => { removeEventListener("sp-fav", u); removeEventListener("storage", u); }; }, [item.code]);
  return (
    <button type="button" className={`fav${big ? " fav-big" : ""}`} aria-pressed={on} aria-label={on ? "Прибрати з обраного" : "Додати в обране"}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOn(toggleFav(item)); }}>
      <svg viewBox="0 0 24 24" width={big ? 20 : 18} height={big ? 20 : 18} aria-hidden="true">
        <path d="M12 20.5s-7.5-4.4-7.5-10.1A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8c0 5.7-7.5 10.1-7.5 10.1z" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      {big && <span>{on ? "В обраному" : "В обране"}</span>}
    </button>
  );
}
