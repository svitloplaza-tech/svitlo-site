"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ModelCard from "@/components/ModelCard";
import { loadPhotoQuery, savePhotoQuery, searchByPhoto, toSmallJpeg, type PhotoHit } from "@/lib/photoSearch";

export default function PhotoSearch() {
  const [q, setQ] = useState<string | null>(null);
  const [hits, setHits] = useState<PhotoHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const run = useCallback(async (d: string) => {
    setQ(d); setHits(null); setErr(""); setBusy(true); savePhotoQuery(d);
    try { setHits(await searchByPhoto(d)); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }, []);
  const take = useCallback(async (b: Blob | null | undefined) => {
    if (!b || !b.type.startsWith("image/")) return;
    try { await run(await toSmallJpeg(b)); } catch { setErr("Не вдалося відкрити це фото"); }
  }, [run]);

  useEffect(() => {
    const go = () => { const d = loadPhotoQuery(); if (d) run(d); };
    go();
    window.addEventListener("sp-photo-q", go); // нове фото з кнопки в шапці, коли ми вже на цій сторінці
    return () => window.removeEventListener("sp-photo-q", go);
  }, [run]);
  // Ctrl+V: вставити скріншот
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const it = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      if (it) { e.preventDefault(); take(it.getAsFile()); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [take]);

  return (
    <main className="wrap section">
      <div className="crumbs"><Link href="/katalog">Каталог</Link><span>/</span><span>Пошук за фото</span></div>
      <div className="page-head">
        <h1>Пошук за фото</h1>
        <p>Завантажте фото або скріншот світильника, і ми покажемо найсхожіші моделі з каталогу.</p>
      </div>
      <div className={`photo-q${drag ? " drag" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files?.[0]); }}>
        {q && <img src={q} alt="Ваше фото" />}
        <div>
          <button type="button" className="btn btn-main" onClick={() => file.current?.click()}>{q ? "Інше фото" : "Обрати фото"}</button>
          <span className="mute">або перетягніть сюди чи вставте Ctrl+V</span>
        </div>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { take(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {busy && <p className="mute">Шукаємо схожі світильники…</p>}
      {err && <p className="photo-err">{err}</p>}
      {hits && !hits.length && <p className="mute">Схожих моделей не знайшли. Спробуйте інше фото або <Link href="/katalog">каталог</Link>.</p>}
      {hits && hits.length > 0 && <div className="grid">{hits.map((h, i) => <ModelCard key={h.code} m={h.model} i={i} />)}</div>}
    </main>
  );
}
