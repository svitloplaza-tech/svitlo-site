import { db } from "@/lib/supabase";
import { cardPhoto } from "@/lib/catalog";
import { absImg, SITE } from "@/lib/img";
import { describeModel, type DModel, type DSeries, type DVariant } from "@/lib/describe";

// Фід товарів для Google Merchant Center (безкоштовні оголошення, «Покупки», Google Lens): /merchant.xml.
// Кожен артикул з ціною — окремий товар; варіанти однієї моделі пов'язані item_group_id. «За запитом» (без ціни) не додаємо.
export const revalidate = 3600;

type Row = Record<string, unknown>;
async function all(table: string, cols: string, build: (q: ReturnType<typeof db.from>) => unknown = (q) => q) {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = (build(db.from(table)) as any).select(cols).eq("is_active", true).order(table === "variants" ? "sku" : "code").range(from, from + 999);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const x = (s: unknown) => String(s ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cut = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…");
const full = (u: string | null | undefined) => {
  if (!u) return null;
  if (u.includes("linef.com.ua/uploads/products/middle/")) u = u.replace("/middle/", "/original/");
  return absImg(u);
};
// Google: Дім і сад > Освітлення (594); люстри/підвіси — Стельові світильники (2524), бра (6073), лампи настільні/торшери (4636), вуличні (3006)
const GCAT: Record<string, string> = { L: "2524", P: "2524", C: "2524", W: "6073", T: "4636", F: "4636", O: "3006" };

export async function GET() {
  const [models, variants, series] = await Promise.all([
    all("models", "*"),
    all("variants", "sku,model_code,size,color,temp,price,old_price,in_stock,photo,photos,specs"),
    db.from("series").select("id,name,own,standalone,intro,seo").then((r) => r.data ?? []),
  ]);
  const S = new Map((series as Row[]).map((s) => [s.id as string, s]));
  const V = new Map<string, Row[]>();
  for (const v of variants) (V.get(v.model_code as string) ?? V.set(v.model_code as string, []).get(v.model_code as string)!).push(v);

  const items: string[] = [];
  for (const m of models) {
    const vs = (V.get(m.code as string) ?? []).filter((v) => typeof v.price === "number" && (v.price as number) > 0);
    if (!vs.length) continue;
    let desc = "";
    try { desc = describeModel(m as unknown as DModel, (V.get(m.code as string) ?? []) as unknown as DVariant[], (S.get(m.series_id as string) ?? null) as unknown as DSeries).body.join(" "); } catch { /* опис не обов'язковий */ }
    if (!desc) desc = String(m.description ?? m.title);
    const ai = ((m.photos_ai as string[]) ?? []).map(full); // власні ШІ-інтер'єри — першими серед додаткових
    const extra = [full(m.photo_interior as string), full(m.photo as string)];
    for (const v of vs) {
      const main = full(v.photo as string) ?? full(m.photo as string) ?? (cardPhoto(m.photo as string) ? absImg(m.photo as string) : null);
      if (!main) continue;
      const add = [...new Set([...ai, ...((v.photos as string[]) ?? []).map(full), ...extra].filter((u): u is string => !!u && u !== main))].slice(0, 5);
      const parts = [v.size, v.color].filter(Boolean).join(", ");
      const title = cut(`${m.title} ${m.code}${parts ? `, ${parts}` : ""}`, 150);
      const price = v.price as number, old = v.old_price as number | null;
      const sale = old && old > price;
      items.push(`<item>
<g:id>${x(v.sku)}</g:id>
<g:item_group_id>${x(m.code)}</g:item_group_id>
<g:title>${x(title)}</g:title>
<g:description>${x(cut(desc, 5000))}</g:description>
<g:link>${SITE}/p/${x(m.slug)}</g:link>
<g:image_link>${x(main)}</g:image_link>
${add.map((u) => `<g:additional_image_link>${x(u)}</g:additional_image_link>`).join("\n")}
<g:availability>${v.in_stock ? "in_stock" : "out_of_stock"}</g:availability>
<g:price>${(sale ? old : price)!.toFixed(2)} UAH</g:price>${sale ? `\n<g:sale_price>${price.toFixed(2)} UAH</g:sale_price>` : ""}
<g:brand>Svitlo Plaza</g:brand>
<g:mpn>${x(v.sku)}</g:mpn>
<g:identifier_exists>no</g:identifier_exists>
<g:condition>new</g:condition>
<g:google_product_category>${GCAT[m.kind_code as string] ?? "594"}</g:google_product_category>
<g:product_type>${x(`Світильники > ${m.kind_name ?? ""}`)}</g:product_type>${v.color ? `\n<g:color>${x(cut(String(v.color), 100))}</g:color>` : ""}${v.size ? `\n<g:size>${x(cut(String(v.size), 100))}</g:size>` : ""}
</item>`);
    }
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>Svitlo Plaza</title>
<link>${SITE}</link>
<description>Світильники Svitlo Plaza</description>
${items.join("\n")}
</channel>
</rss>`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
