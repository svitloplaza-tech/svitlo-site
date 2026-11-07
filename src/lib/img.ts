/** Фото зі Supabase Storage віддаємо через власний домен /f/… (Supabase додає x-robots-tag: none — Google такі фото не індексує). */
const SB = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://teidqxvftoihhwmubiyf.supabase.co") + "/storage/v1/object/public/";
export const SITE = "https://www.svitloplaza.store";
export const SB_PUBLIC = SB;
export function img(u: string | null | undefined): string | null {
  if (!u) return null;
  return u.startsWith(SB) ? "/f/" + u.slice(SB.length) : u;
}
/** Абсолютна адреса (для sitemap, og:image, JSON-LD). */
export function absImg(u: string | null | undefined): string | null {
  const x = img(u);
  return x && x.startsWith("/") ? SITE + x : x;
}
/** Чи це власне фото (Storage), а не посилання на LineF. */
export const ownImg = (u: string | null | undefined) => !!u && u.startsWith(SB);
