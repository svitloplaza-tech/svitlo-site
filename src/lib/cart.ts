"use client";
// Кошик у браузері покупця (localStorage). Оформлення замовлення — наступний етап (сервер → Supabase → SalesDrive).
export type CartItem = { sku: string; code: string; title: string; variant: string; price: number | null; photo: string | null; qty: number };
const KEY = "sp-cart-v1";
export function readCart(): CartItem[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function writeCart(items: CartItem[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
  window.dispatchEvent(new Event("sp-cart"));
}
export function addToCart(item: Omit<CartItem, "qty">) {
  const items = readCart();
  const f = items.find((i) => i.sku === item.sku);
  if (f) f.qty += 1; else items.push({ ...item, qty: 1 });
  writeCart(items);
}
export const cartCount = (items: CartItem[]) => items.reduce((s, i) => s + i.qty, 0);
