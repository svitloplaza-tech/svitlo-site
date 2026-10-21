"use client";
import Link from "next/link";
import { useState } from "react";
import { cardPhoto, fmt, swatch, type CatalogModel } from "@/lib/catalog";
import FavButton from "@/components/FavButton";

export default function ModelCard({ m, i = 0, photos }: { m: CatalogModel; i?: number; photos?: Record<string, string> }) {
  const cols = (m.colors ?? []).slice(0, 5);
  const [img, setImg] = useState(cardPhoto(m.photo));
  const [bad, setBad] = useState(false);
  const [cur, setCur] = useState(0);
  return (
    <Link className="card" href={`/p/${m.slug}`} style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
      <div className="ph">
        {!m.in_stock && <span className="badge out">НЕМАЄ</span>}
        <FavButton item={{ code: m.code, slug: m.slug, title: m.title, photo: m.photo, price_from: m.price_from, in_stock: m.in_stock, variants_count: m.variants_count, colors: m.colors }} />
        {img && !bad && <img src={img} alt={m.title} loading="lazy" decoding="async" width={480} height={480}
          onError={() => { const o = m.photo; if (o && img !== o) setImg(o); else setBad(true); }} />}
      </div>
      <div className="meta">
        <span className="code">{m.code}</span>
        {cols.length > 1 && (
          <span className="dots">
            {cols.map((c, k) => (
              <button key={c} type="button" title={c} aria-label={c} aria-pressed={k === cur} style={{ background: swatch(c) }}
                onMouseEnter={() => { setCur(k); if (photos?.[c]) { setBad(false); setImg(cardPhoto(photos[c])); } }}
                onClick={(e) => { e.preventDefault(); setCur(k); if (photos?.[c]) { setBad(false); setImg(cardPhoto(photos[c])); } }} />
            ))}
          </span>
        )}
      </div>
      <h3>{m.title}</h3>
      <div className="price">
        {m.price_from != null ? (<>{m.variants_count > 1 && <span className="from">від</span>}{fmt(m.price_from)}<small>₴</small></>)
          : <span className="from">Ціна за запитом</span>}
      </div>
    </Link>
  );
}
