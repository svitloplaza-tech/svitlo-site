"use client";
import { useEffect, useRef } from "react";

/** Проявлення карток колекцій під час прокрутки: --v 0→1, коли картка підходить до центру екрана.
 *  Наведення (ПК) або дотик (телефон) — майже повне відображення (клас .hot / :hover у CSS). */
export default function CollectionsReveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current!; const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const vis = new Set<HTMLElement>();
    const io = new IntersectionObserver((es) => { for (const e of es) e.isIntersecting ? vis.add(e.target as HTMLElement) : vis.delete(e.target as HTMLElement); tick(); }, { rootMargin: "20% 0px" });
    root.querySelectorAll<HTMLElement>(".col").forEach((el) => io.observe(el));
    let raf = 0;
    const tick = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0;
      const c = innerHeight / 2;
      for (const el of vis) { const r = el.getBoundingClientRect(); const d = Math.abs(r.top + r.height / 2 - c) / (innerHeight * 0.6);
        el.style.setProperty("--v", reduce ? "1" : Math.max(0, 1 - d * d).toFixed(3)); } }); };
    addEventListener("scroll", tick, { passive: true }); addEventListener("resize", tick);
    // дотик: картка «загоряється», поки палець на ній
    const on = (e: Event) => (e.target as HTMLElement).closest?.(".col")?.classList.add("hot");
    const off = () => root.querySelectorAll(".col.hot").forEach((x) => x.classList.remove("hot"));
    root.addEventListener("touchstart", on, { passive: true }); addEventListener("touchend", off); addEventListener("touchcancel", off);
    return () => { io.disconnect(); removeEventListener("scroll", tick); removeEventListener("resize", tick);
      root.removeEventListener("touchstart", on); removeEventListener("touchend", off); removeEventListener("touchcancel", off); cancelAnimationFrame(raf); };
  }, []);
  return <div ref={ref}>{children}</div>;
}
