import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

/** Старі адреси товарів svitloplaza.store (WordPress): /product/{slug}/ → /p/{код}, щоб не втратити посилання й позиції в Google. */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const s = decodeURIComponent(slug).replace(/[%_\\]/g, "");
  const { data } = await db.from("variants").select("model_code").eq("supplier", "Svitlo Plaza")
    .ilike("url_supplier", `%/product/${s}/%`).limit(1);
  const code = (data?.[0] as { model_code?: string } | undefined)?.model_code;
  return NextResponse.redirect(new URL(code ? `/p/${code.toLowerCase()}` : guessKind(s), req.url), 301);
}

/** Товару вже немає — ведемо в розділ за словами в старій адресі (а не на загальний /katalog: Google вважає таке «м'яким 404»). */
function guessKind(slug: string): string {
  const k: [RegExp, string][] = [
    [/torsher/, "torshery"], [/nastiln/, "nastilni"], [/(^|-)bra(-|$)/, "bra"],
    [/vulych|fasad|landshaft|gazon|grunt/, "vulychni"], [/pidvis|pidves/, "pidvisni"],
    [/lyustr/, "lyustry"], [/stel|tochkov|downlight|panel|linijn/, "stelovi"],
  ];
  for (const [re, slugKind] of k) if (re.test(slug)) return `/katalog/${slugKind}`;
  return "/katalog";
}
