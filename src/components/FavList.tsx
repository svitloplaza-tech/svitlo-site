"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import ModelCard from "@/components/ModelCard";
import { readFav, type FavItem } from "@/lib/fav";
import type { CatalogModel } from "@/lib/catalog";

export default function FavList() {
  const [items, setItems] = useState<FavItem[] | null>(null);
  useEffect(() => { const u = () => setItems(readFav()); u(); addEventListener("sp-fav", u); return () => removeEventListener("sp-fav", u); }, []);
  if (items === null) return null;
  if (!items.length) return <div className="empty-note">Тут поки порожньо. Натисніть ♡ на картці світильника, щоб зберегти його. <Link href="/katalog" style={{ color: "var(--sp-warm)" }}>До каталогу</Link></div>;
  return <div className="grid">{items.map((m, i) => <ModelCard key={m.code} m={m as CatalogModel} i={i} />)}</div>;
}
