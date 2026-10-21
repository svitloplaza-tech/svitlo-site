"use client";
// Обране покупця (localStorage, на рівні моделі). Подія "sp-fav" — для лічильника в шапці.
import type { CatalogModel } from "./catalog";
export type FavItem = Pick<CatalogModel, "code" | "slug" | "title" | "photo" | "price_from" | "in_stock" | "variants_count" | "colors"> & Partial<CatalogModel>;
const KEY = "sp-fav-v1";
export function readFav(): FavItem[] { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
function write(items: FavItem[]) { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {} window.dispatchEvent(new Event("sp-fav")); }
export const isFav = (code: string) => readFav().some((i) => i.code === code);
export function toggleFav(item: FavItem): boolean {
  const items = readFav(), has = items.some((i) => i.code === item.code);
  write(has ? items.filter((i) => i.code !== item.code) : [{ ...item }, ...items].slice(0, 200));
  return !has;
}
export function removeFav(code: string) { write(readFav().filter((i) => i.code !== code)); }
