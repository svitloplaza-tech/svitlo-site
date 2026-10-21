// Оформлення замовлення: ціни й товари перевіряє база (функція create_order), оплата mono — через Edge-функцію mono-pay.
import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

const SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://teidqxvftoihhwmubiyf.supabase.co";
const ERR: Record<string, string> = { phone: "Перевірте номер телефону", name: "Вкажіть прізвище та ім'я", payment: "Оберіть спосіб оплати",
  items: "Кошик порожній", delivery: "Оберіть спосіб доставки" };

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Помилка запиту" }, { status: 400 });
  const { data, error } = await db.rpc("create_order", { p: body });
  if (error) {
    const k = Object.keys(ERR).find((x) => error.message.startsWith(x));
    const sku = error.message.match(/^sku (.+)$/)?.[1];
    return NextResponse.json({ error: k ? ERR[k] : sku ? `Товар ${sku} більше недоступний — приберіть його з кошика` : "Не вдалося оформити замовлення, спробуйте ще раз" }, { status: 400 });
  }
  const o = data as { number: number; token: string; total: number };
  const thanks = `${new URL(req.url).origin}/zamovlennia?n=${o.number}&t=${o.token}`;
  if (body.payment === "mono") {
    const r = await fetch(`${SB}/functions/v1/mono-pay`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ number: o.number, token: o.token, return: thanks }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) as { pageUrl?: string } : {};
    if (j.pageUrl) return NextResponse.json({ ...o, redirect: j.pageUrl });
  }
  return NextResponse.json({ ...o, redirect: thanks });
}
