"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addToCart } from "@/lib/cart";
import FavButton from "@/components/FavButton";
import { fmt, swatch, type Model, type Variant } from "@/lib/catalog";
import { img } from "@/lib/img";

export default function ProductView({ model, variants }: { model: Model; variants: Variant[] }) {
  const sizes = useMemo(() => [...new Set(variants.map((v) => v.size).filter(Boolean) as string[])].sort((a, b) => parseFloat(a) - parseFloat(b)), [variants]);
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color).filter(Boolean) as string[])], [variants]);
  const [cur, setCur] = useState<Variant>(variants.find((v) => v.in_stock) ?? variants[0]);
  const imgs = useMemo(() => {
    // головні фото варіантів → фото моделі → ШІ-інтер'єри (models.photos_ai) → решта фото варіантів (ракурси, креслення, інтер'єри) → інтер'єр моделі
    return [...new Set([...variants.map((v) => v.photo), model.photo, ...(model.photos_ai ?? []), ...variants.flatMap((v) => v.photos ?? []), model.photo_interior]
      .map(img).filter(Boolean) as string[])];
  }, [variants, model]);
  const [shown, setShown] = useState<string | null>(img(cur?.photo ?? model.photo));
  const [fade, setFade] = useState(false);
  const [added, setAdded] = useState(false);

  const show = (u: string | null) => {
    if (!u || u === shown) return;
    setFade(true); setTimeout(() => { setShown(u); setFade(false); }, 180);
  };
  // гортання фото: стрілки, свайп пальцем, клавіші ← →
  const idx = Math.max(0, imgs.indexOf(shown ?? ""));
  const step = (d: number) => { if (imgs.length > 1) show(imgs[(idx + d + imgs.length) % imgs.length]); };
  const touch = useRef<{ x: number; y: number } | null>(null);
  // повноекранний перегляд фото (тап по великому фото): гортання стрілками/свайпом, закриття — Esc, ×, тап по фону
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    if (!zoom) return;
    document.documentElement.classList.add("menu-open");
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setZoom(false); if (e.key === "ArrowLeft") step(-1); if (e.key === "ArrowRight") step(1); };
    window.addEventListener("keydown", k);
    return () => { document.documentElement.classList.remove("menu-open"); window.removeEventListener("keydown", k); };
  });
  const swipe = { onTouchStart: (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; },
    onTouchEnd: (e: React.TouchEvent) => {
      const t = touch.current; touch.current = null; if (!t) return;
      const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    } };
  const choose = (size: string | null, color: string | null) => {
    const v = variants.find((x) => x.size === size && x.color === color)
      ?? variants.find((x) => (size != null ? x.size === size : x.color === color)) ?? cur;
    setCur(v); show(img(v.photo)); setAdded(false);
  };
  if (!cur) return <p className="mute">Варіанти цієї моделі тимчасово недоступні.</p>;

  return (
    <div className="pv">
      <div className="gal">
        <div className="ph" id="big" tabIndex={imgs.length > 1 ? 0 : undefined} aria-label={imgs.length > 1 ? "Фото товару, гортайте стрілками" : undefined}
          onKeyDown={(e) => { if (e.key === "ArrowLeft") step(-1); if (e.key === "ArrowRight") step(1); }}
          {...swipe}>
          {shown && <img src={shown} alt={`${model.title} ${model.code}${idx ? ` — фото ${idx + 1}` : ""}`} className={fade ? "fade" : ""} draggable={false} onClick={() => setZoom(true)} style={{ cursor: "zoom-in" }} />}
          {imgs.length > 1 && (<>
            <button type="button" className="nav prev" aria-label="Попереднє фото" onClick={() => step(-1)}>‹</button>
            <button type="button" className="nav next" aria-label="Наступне фото" onClick={() => step(1)}>›</button>
            <span className="cnt" aria-hidden="true">{idx + 1} / {imgs.length}</span>
          </>)}
        </div>
        {imgs.length > 1 && (
          <div className="thumbs">
            {imgs.map((u, i) => (
              <button key={u} type="button" aria-pressed={u === shown} onClick={() => show(u)} aria-label="Показати фото"><img src={u} alt={`${model.title} ${model.code} — фото ${i + 1}`} loading="lazy" /></button>
            ))}
          </div>
        )}
        {zoom && shown && createPortal(
          <div className="lbox" role="dialog" aria-modal="true" aria-label="Перегляд фото" onClick={() => setZoom(false)} {...swipe}>
            <img src={shown} alt={`${model.title} ${model.code}`} className={fade ? "fade" : ""} onClick={(e) => e.stopPropagation()} draggable={false} />
            <button type="button" className="lb-x" aria-label="Закрити">×</button>
            {imgs.length > 1 && (<>
              <button type="button" className="nav prev" aria-label="Попереднє фото" onClick={(e) => { e.stopPropagation(); step(-1); }}>‹</button>
              <button type="button" className="nav next" aria-label="Наступне фото" onClick={(e) => { e.stopPropagation(); step(1); }}>›</button>
              <span className="cnt" aria-hidden="true">{idx + 1} / {imgs.length}</span>
            </>)}
          </div>, document.body
        )}
      </div>
      <div className="info">
        <span className="pcode"><b>{model.code}</b><span>{model.kind_name}</span></span>
        <h1>{model.title}</h1>
        <div>
          <div className="bigprice">{cur.price != null ? <>{fmt(cur.price)}<small>₴</small></> : <span style={{ font: "400 20px var(--f-text)" }}>Ціна за запитом</span>}</div>
          <div className={`stock${cur.in_stock ? "" : " no"}`} style={{ marginTop: 12 }}><i />{cur.availability ?? (cur.in_stock ? "В наявності" : "Немає в наявності")}</div>
        </div>
        {sizes.length > 1 && (
          <div className="opt"><h4>Розмір<b>{cur.size}</b></h4><div className="opts">
            {sizes.map((s) => (
              <button key={s} type="button" aria-pressed={s === cur.size} data-dim={variants.some((v) => v.size === s && v.color === cur.color) ? undefined : ""} onClick={() => choose(s, cur.color)}>{s}</button>
            ))}
          </div></div>
        )}
        {colors.length > 1 && (
          <div className="opt"><h4>Колір<b>{cur.color}</b></h4><div className="opts">
            {colors.map((c) => (
              <button key={c} type="button" className="txt" aria-pressed={c === cur.color} data-dim={variants.some((v) => v.color === c && v.size === cur.size) ? undefined : ""} onClick={() => choose(cur.size, c)}>
                <i style={{ background: swatch(c) }} />{c}
              </button>
            ))}
          </div></div>
        )}
        <div className="cta">
          <button type="button" className="btn btn-main" onClick={() => {
            addToCart({ sku: cur.sku, code: model.code, title: model.title, variant: [cur.size, cur.color].filter(Boolean).join(", "), price: cur.price, photo: cur.photo ?? model.photo });
            setAdded(true);
          }}>{added ? "Додано ✓" : "До кошика"}</button>
          <a className="btn btn-sec" href="/shourum">Подивитися в шоурумі</a>
          <FavButton big item={{ code: model.code, slug: model.slug, title: model.title, photo: model.photo, in_stock: variants.some((v) => v.in_stock),
            price_from: Math.min(...variants.map((v) => v.price ?? Infinity)) === Infinity ? null : Math.min(...variants.map((v) => v.price ?? Infinity)),
            variants_count: variants.length, colors: [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[] }} />
        </div>
        <div className="notes"><div><b>Нова Пошта</b>Доставка по Україні</div><div><b>Оплата</b>Онлайн або накладеним платежем</div><div><b>Шоурум</b>Можна побачити наживо</div></div>
        <dl className="specs">
          {([["Артикул", cur.sku], ["Код моделі", model.code], ["Розмір", cur.size], ["Колір", cur.color], ["Колірна температура", cur.temp], ["Потужність", spec(cur, "Потужність")], ["Світловий потік", spec(cur, "Світловий потік")], ["Варіантів моделі", String(variants.length)]] as [string, string | null][])
            .filter(([, v]) => v).map(([a, b]) => (<div key={a} style={{ display: "contents" }}><dt>{a}</dt><dd>{b}</dd></div>))}
        </dl>
        <span className="perma">Постійна адреса товару: <b>svitloplaza.store/p/{model.slug}</b></span>
      </div>
    </div>
  );
}

function spec(v: Variant, k: string): string | null {
  const x = v.specs?.[k];
  return typeof x === "string" && x.trim() ? x : null;
}
