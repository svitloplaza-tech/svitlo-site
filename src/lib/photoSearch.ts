// Пошук за фото: стискання фото в браузері + запит до Edge-функції photo-search (Supabase).
import type { CatalogModel } from "./catalog";

const SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://teidqxvftoihhwmubiyf.supabase.co";
const KEY = "sp-photo-q";
export type PhotoHit = { code: string; score: number; url: string; model: CatalogModel };

/** Фото/скріншот → JPEG до 640 px (≈50–80 КБ), щоб швидко відправити з телефона. */
export async function toSmallJpeg(file: Blob, max = 640): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); // прозорий PNG → білий фон
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return c.toDataURL("image/jpeg", 0.85);
}

export function savePhotoQuery(d: string) { try { sessionStorage.setItem(KEY, d); } catch { /* приватний режим */ } }
export function loadPhotoQuery(): string | null { try { return sessionStorage.getItem(KEY); } catch { return null; } }

export async function searchByPhoto(image: string, n = 24): Promise<PhotoHit[]> {
  const r = await fetch(`${SB}/functions/v1/photo-search`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image, n }),
  });
  const j = await r.json().catch(() => ({})) as { items?: PhotoHit[]; error?: string };
  if (!r.ok) throw new Error(j.error || "Не вдалося виконати пошук, спробуйте ще раз");
  return j.items ?? [];
}
