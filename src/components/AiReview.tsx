"use client";
import { useCallback, useEffect, useState } from "react";
import { img } from "@/lib/img";

const FN = "https://teidqxvftoihhwmubiyf.supabase.co/functions/v1/ai-gen";
type C = { id: number; model_code: string; url: string; gen_model: string; status: string; note: string | null; exact: boolean | null; site_url: string | null;
  models: { title: string; slug: string; photo: string; kind_code: string; facets: { w?: number[]; l?: number[]; h?: number[] } | null } };

/** Затвердження ШІ-кадрів: зліва референс (фото товару), справа кадр. ✓ — на сайт, ✗ — відхилити (з причиною → перегенерація). */
export default function AiReview() {
  const [k, setK] = useState("");
  const [st, setSt] = useState("pending");
  const [list, setList] = useState<C[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { setK(new URLSearchParams(location.hash.slice(1)).get("k") ?? ""); }, []);
  const load = useCallback(async () => {
    if (!k) return;
    setList(null); setErr("");
    const r = await fetch(`${FN}?action=list&status=${st}`, { headers: { "x-ai-secret": k } });
    if (!r.ok) { setErr(`Помилка ${r.status}`); return; }
    setList(await r.json());
  }, [k, st]);
  useEffect(() => { load(); }, [load]);

  const post = (body: object) => fetch(`${FN}?action=decide`, { method: "POST", headers: { "x-ai-secret": k, "content-type": "application/json" }, body: JSON.stringify(body) });
  const decide = async (c: C, status: string, note?: string, exact?: boolean) => {
    const r = await post({ id: c.id, status, note, ...(exact === undefined ? {} : { exact }) });
    if (r.ok) setList((l) => l?.filter((x) => x.id !== c.id) ?? null); else alertless(`Не збережено (${r.status})`);
  };
  // «точно збігається з товаром» (форма, к-сть плафонів і кріплень, кольори, матеріали) — лише такі кадри йдуть у Google Merchant
  const setExact = async (c: C, exact: boolean) => {
    const r = await post({ id: c.id, exact });
    if (r.ok) setList((l) => l?.map((x) => (x.id === c.id ? { ...x, exact } : x)) ?? null); else alertless(`Не збережено (${r.status})`);
  };
  const alertless = (m: string) => setErr(m);
  const reasons = ["форма не та", "масштаб", "кріплення", "зайве в кадрі", "погане світло"];

  if (!k) return <p className="mute">Відкрийте сторінку за службовим посиланням.</p>;
  return (
    <div className="air">
      <div className="page-head"><h1>ШІ-інтер&apos;єри <span className="mute">{list ? `${list.length} шт.` : "…"}</span></h1></div>
      <div className="air-tabs">
        {[["pending", "На перевірку"], ["approved", "Схвалені"], ["rejected", "Відхилені"], ["published", "На сайті"]].map(([v, t]) => (
          <button key={v} className={st === v ? "on" : ""} onClick={() => setSt(v)}>{t}</button>))}
      </div>
      <p className="mute air-hint">«Точно» — форма, кількість плафонів і кріплень до стелі, кольори, матеріали й декор збігаються з фото товару: такі кадри йдуть у Google Merchant. Неточні лишаються на сайті як атмосфера.</p>
      {err && <p className="air-err">{err}</p>}
      {list?.length === 0 && <p className="mute">Порожньо.</p>}
      <div className="air-list">
        {list?.map((c) => {
          const f = c.models.facets ?? {};
          const dims = [f.w?.[1] && `Ш ${f.w[1]}`, f.l?.[1] && f.l[1] !== f.w?.[1] && `Д ${f.l[1]}`, f.h?.[1] && `В ${f.h[1]}`].filter(Boolean).join(" × ");
          return (
            <div className="air-row" key={c.id}>
              <div className="air-head">
                <a href={`/p/${c.models.slug}`} target="_blank" rel="noreferrer"><b>{c.model_code}</b> {c.models.title}</a>
                <span className="mute">{dims && `${dims} см · `}{c.gen_model.replace("-preview", "")}{c.note ? ` · ${c.note}` : ""}</span>
                {c.exact === true && <span className="air-tag ok">точно · Merchant</span>}
                {c.exact === false && <span className="air-tag">лише сайт</span>}
              </div>
              <div className="air-pics">
                <img src={img(c.models.photo) ?? ""} alt="референс" loading="lazy" className="ref" />
                <a href={c.url} target="_blank" rel="noreferrer"><img src={img(c.url) ?? ""} alt={`кадр ${c.id}`} loading="lazy" /></a>
              </div>
              <div className="air-act">
                {st === "pending" || st === "rejected" ? <>
                  <button className="ok" onClick={() => decide(c, "approved", undefined, true)}>✓ Точно — сайт + Merchant</button>
                  <button className="ok2" onClick={() => decide(c, "approved", undefined, false)}>✓ Лише сайт (атмосфера)</button>
                </> : <>
                  <button className={c.exact === true ? "ok" : "why"} onClick={() => setExact(c, true)}>✓ Точно збігається</button>
                  <button className={c.exact === false ? "no" : "why"} onClick={() => setExact(c, false)}>≈ Неточно (лише сайт)</button>
                </>}
                {(st === "pending" || st === "approved") && <>
                  <button className="no" onClick={() => decide(c, "rejected")}>✗ Відхилити</button>
                  {reasons.map((r) => <button key={r} className="why" onClick={() => decide(c, "rejected", r)}>{r}</button>)}
                </>}
                {st !== "pending" && st !== "published" && <button className="why" onClick={() => decide(c, "pending")}>↺ повернути</button>}
              </div>
            </div>
          );
        })}
      </div>
      <style>{`
        .air-tabs{display:flex;gap:8px;margin:0 0 20px;flex-wrap:wrap}
        .air-tabs button,.air-act button{white-space:nowrap;border:1px solid var(--sp-gray);background:none;color:inherit;padding:8px 14px;border-radius:999px;cursor:pointer;font:inherit}
        .air-tabs button.on{background:var(--sp-white);color:var(--sp-black)}
        .air-err{color:var(--sp-ember)}
        .air-row{border-top:1px solid var(--sp-gray);padding:18px 0}
        .air-head{display:flex;gap:12px;flex-wrap:wrap;align-items:baseline;margin-bottom:10px}
        .air-head a{color:inherit}
        .air-pics{display:grid;grid-template-columns:1fr 2fr;gap:10px;align-items:start}
        .air-pics img{width:100%;height:auto;display:block;border-radius:8px}
        .air-pics img.ref{background:#fff}
        .air-act{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
        .air-act .ok{background:var(--sp-warm);color:var(--sp-black);border-color:var(--sp-warm)}
        .air-act .no{border-color:var(--sp-ember)}
        .air-act .ok2{border-color:var(--sp-warm)}
        .air-tag{font-size:12px;padding:2px 8px;border-radius:999px;border:1px solid var(--sp-gray);white-space:nowrap}
        .air-tag.ok{background:var(--sp-warm);color:var(--sp-black);border-color:var(--sp-warm)}
        .air-hint{font-size:13px;margin:0 0 16px}
        .air-act .why{font-size:13px;color:var(--sp-mute)}
        @media(max-width:700px){.air-pics{grid-template-columns:1fr 2fr}}
      `}</style>
    </div>
  );
}
