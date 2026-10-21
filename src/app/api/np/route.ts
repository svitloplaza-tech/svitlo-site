// Довідник Нової Пошти для оформлення замовлення (міста, відділення, поштомати). Публічне API НП, без ключа.
import { NextResponse } from "next/server";

const NP = "https://api.novaposhta.ua/v2.0/json/";
async function np(modelName: string, calledMethod: string, methodProperties: Record<string, string>) {
  const r = await fetch(NP, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKey: process.env.NP_API_KEY ?? "", modelName, calledMethod, methodProperties }) });
  const j = await r.json() as { success: boolean; data: unknown[] };
  return j.success ? j.data : [];
}
const ok = (d: unknown) => NextResponse.json(d, { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } });

export async function GET(req: Request) {
  const u = new URL(req.url), op = u.searchParams.get("op"), q = (u.searchParams.get("q") ?? "").slice(0, 60);
  if (op === "cities") {
    if (q.trim().length < 2) return ok([]);
    const d = await np("AddressGeneral", "searchSettlements", { CityName: q, Limit: "20", Page: "1" }) as { Addresses: { Present: string; DeliveryCity: string; Warehouses: number }[] }[];
    return ok((d[0]?.Addresses ?? []).filter((a) => a.DeliveryCity && a.Warehouses > 0).map((a) => ({ ref: a.DeliveryCity, name: a.Present })));
  }
  if (op === "wh") {
    const city = u.searchParams.get("city") ?? "", kind = u.searchParams.get("kind") === "pm" ? "Postomat" : "Branch";
    if (!/^[0-9a-f-]{36}$/.test(city)) return ok([]);
    const d = await np("Address", "getWarehouses", { CityRef: city, FindByString: q, Limit: "500", Page: "1" }) as
      { Ref: string; Description: string; Number: string; CategoryOfWarehouse: string }[];
    return ok(d.filter((w) => (kind === "Postomat" ? w.CategoryOfWarehouse === "Postomat" : w.CategoryOfWarehouse !== "Postomat"))
      .map((w) => ({ ref: w.Ref, name: w.Description, n: Number(w.Number) || 0 })).sort((a, b) => a.n - b.n));
  }
  return NextResponse.json({ error: "op" }, { status: 400 });
}
