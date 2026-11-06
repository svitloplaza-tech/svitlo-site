import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

/** Старі адреси товарів svitloplaza.store (WordPress): /product/{slug}/ → /p/{код}, щоб не втратити посилання й позиції в Google. */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const s = decodeURIComponent(slug).replace(/[%_\\]/g, "");
  const { data } = await db.from("variants").select("model_code").eq("supplier", "Svitlo Plaza")
    .ilike("url_supplier", `%/product/${s}/%`).limit(1);
  const code = (data?.[0] as { model_code?: string } | undefined)?.model_code;
  return NextResponse.redirect(new URL(code ? `/p/${code.toLowerCase()}` : "/katalog", req.url), 301);
}
