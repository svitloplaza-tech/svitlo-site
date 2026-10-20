"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FAMILIES } from "@/lib/catalog";

export default function CatalogFilters() {
  const router = useRouter(), path = usePathname(), sp = useSearchParams();
  const fam = new Set((sp.get("kolir") ?? "").split(",").filter(Boolean));
  const stock = sp.get("nayavnist") === "1";
  const sort = sp.get("sort") ?? "pop";
  const go = (mut: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(sp.toString()); mut(p); p.delete("page");
    router.push(`${path}${p.toString() ? `?${p}` : ""}`, { scroll: false });
  };
  return (
    <div className="bar"><div className="wrap">
      {FAMILIES.map((f) => (
        <button key={f.id} type="button" className="chipf" aria-pressed={fam.has(f.id)} onClick={() => go((p) => {
          const s = new Set(fam); s.has(f.id) ? s.delete(f.id) : s.add(f.id);
          s.size ? p.set("kolir", [...s].join(",")) : p.delete("kolir");
        })}><i style={{ background: f.sw }} />{f.name}</button>
      ))}
      <span className="sep" />
      <button type="button" className="sw" aria-pressed={stock} onClick={() => go((p) => (stock ? p.delete("nayavnist") : p.set("nayavnist", "1")))}><i />Лише в наявності</button>
      <label className="sort">Сортувати
        <select id="sortSel" value={sort} onChange={(e) => go((p) => (e.target.value === "pop" ? p.delete("sort") : p.set("sort", e.target.value)))}>
          <option value="pop">за популярністю</option><option value="asc">спершу дешевші</option><option value="desc">спершу дорожчі</option>
        </select>
      </label>
    </div></div>
  );
}
