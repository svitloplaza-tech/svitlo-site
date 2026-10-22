"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type { GroupView, RangeView } from "@/lib/filters";

/** Панель фільтрів каталогу: рядок (кнопка «Фільтри», вибрані значення, наявність, сортування) + бокова панель з усіма групами. */
export default function CatalogFilters({ groups, ranges, active, total }: { groups: GroupView[]; ranges: RangeView[]; active: number; total: number }) {
  const router = useRouter(), path = usePathname(), sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [pending, start] = useTransition();
  const stock = sp.get("nayavnist") === "1";
  const sort = sp.get("sort") ?? "pop";

  const go = (mut: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(sp.toString()); mut(p); p.delete("page"); p.delete("n");
    start(() => router.push(`${path}${p.toString() ? `?${p}` : ""}`, { scroll: false }));
  };
  const toggle = (g: string, v: string) => go((p) => {
    const s = new Set((p.get(g) ?? "").split(",").filter(Boolean)); s.has(v) ? s.delete(v) : s.add(v);
    s.size ? p.set(g, [...s].join(",")) : p.delete(g);
  });
  const setRange = (id: string, a: number | null, b: number | null) => go((p) => (a == null && b == null ? p.delete(id) : p.set(id, `${a ?? ""}-${b ?? ""}`)));
  const reset = () => go((p) => { for (const g of groups) p.delete(g.id); for (const r of ranges) p.delete(r.id); });

  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add("menu-open");
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", k);
    return () => { document.documentElement.classList.remove("menu-open"); removeEventListener("keydown", k); };
  }, [open]);

  const chips = [
    ...groups.flatMap((g) => g.sel.map((v) => ({ key: g.id + v, label: g.options.find((o) => o.v === v)?.label ?? v, off: () => toggle(g.id, v) }))),
    ...ranges.filter((r) => r.sel[0] != null || r.sel[1] != null).map((r) => ({
      key: r.id, label: `${r.name.split(",")[0].split(" /")[0]} ${r.sel[0] != null && r.sel[1] != null ? `${r.sel[0]}–${r.sel[1]}` : r.sel[0] != null ? `від ${r.sel[0]}` : `до ${r.sel[1]}`}`, off: () => setRange(r.id, null, null) })),
  ];

  return (
    <>
      <div className="bar" data-pending={pending || undefined}><div className="wrap">
        <button type="button" className="fbtn" onClick={() => setOpen(true)} aria-haspopup="dialog">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          Фільтри{active > 0 && <b>{active}</b>}
        </button>
        {chips.map((c) => <button key={c.key} type="button" className="chipf on" onClick={c.off} aria-label={`Прибрати фільтр ${c.label}`}>{c.label}<span aria-hidden="true">×</span></button>)}
        <span className="sep" />
        <button type="button" className="sw" aria-pressed={stock} onClick={() => go((p) => (stock ? p.delete("nayavnist") : p.set("nayavnist", "1")))}><i />Лише в наявності</button>
        <label className="sort">Сортувати
          <select value={sort} onChange={(e) => go((p) => (e.target.value === "pop" ? p.delete("sort") : p.set("sort", e.target.value)))}>
            <option value="pop">за популярністю</option><option value="asc">спершу дешевші</option><option value="desc">спершу дорожчі</option>
          </select>
        </label>
      </div></div>

      {mounted && createPortal(<>
      {open && <div className="fpanel-bg" onClick={() => setOpen(false)} />}
      <aside className={`fpanel${open ? " open" : ""}`} role="dialog" aria-modal="true" aria-label="Фільтри" aria-hidden={!open} inert={!open}>
        <div className="fp-head"><h2>Фільтри</h2><button type="button" className="fp-x" onClick={() => setOpen(false)} aria-label="Закрити">×</button></div>
        <div className="fp-body" data-pending={pending || undefined}>
          {ranges.map((r) => <RangeBox key={r.id + r.sel.join()} r={r} onApply={(a, b) => setRange(r.id, a, b)} />)}
          {groups.map((g) => (
            <fieldset key={g.id} className="fp-g">
              <legend>{g.name}</legend>
              <div className="fp-opts">
                {g.options.map((o) => (
                  <button key={o.v} type="button" className="fopt" aria-pressed={g.sel.includes(o.v)} disabled={!o.n && !g.sel.includes(o.v)} onClick={() => toggle(g.id, o.v)}>
                    {o.label}<small>{o.n}</small>
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="fp-foot">
          <button type="button" className="btn btn-sec" onClick={reset} disabled={!active}>Скинути</button>
          <button type="button" className="btn btn-main" onClick={() => setOpen(false)}>{pending ? "Рахуємо…" : `Показати ${total}`}</button>
        </div>
      </aside>
      </>, document.body)}
    </>
  );
}

function RangeBox({ r, onApply }: { r: RangeView; onApply: (a: number | null, b: number | null) => void }) {
  const [a, setA] = useState(r.sel[0]?.toString() ?? ""), [b, setB] = useState(r.sel[1]?.toString() ?? "");
  const apply = () => {
    const x = a === "" ? null : Number(a), y = b === "" ? null : Number(b);
    if (x !== r.sel[0] || y !== r.sel[1]) onApply(x, y);
  };
  return (
    <fieldset className="fp-g">
      <legend>{r.name}</legend>
      <form className="fp-range" onSubmit={(e) => { e.preventDefault(); apply(); }}>
        <input inputMode="numeric" placeholder={`від ${r.min}`} value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, ""))} onBlur={apply} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), apply())} aria-label={`${r.name} від`} />
        <span>—</span>
        <input inputMode="numeric" placeholder={`до ${r.max}`} value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, ""))} onBlur={apply} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), apply())} aria-label={`${r.name} до`} />
      </form>
    </fieldset>
  );
}
