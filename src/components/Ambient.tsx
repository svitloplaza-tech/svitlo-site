"use client";
import { useEffect, useRef } from "react";

/** Фон сайту: холодне сяйво 6500K + дрібні штришки-порошинки з легким паралаксом (погоджено 20.10). */
export default function Ambient() {
  const cRef = useRef<HTMLCanvasElement>(null);
  const gRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const c = cRef.current!, g = gRef.current!, x = c.getContext("2d")!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    type P = { x: number; y: number; z: number; len: number; ang: number; a: number; cool: boolean; vx: number; ph: number };
    let W = 0, H = 0, D = 1, ps: P[] = [], alive = true, raf = 0;
    const init = () => {
      D = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
      c.width = W * D; c.height = H * D; x.setTransform(D, 0, 0, D, 0, 0);
      const n = Math.round(Math.min(120, (W * H) / 13000)); ps = [];
      for (let i = 0; i < n; i++) {
        const z = Math.random();
        ps.push({ x: Math.random() * W, y: Math.random() * H * 1.6, z, len: 4 + z * 12, ang: -0.5 + Math.random() * 0.35,
          a: 0.22 + z * 0.38, cool: Math.random() < 0.45, vx: (Math.random() - 0.5) * 0.04, ph: Math.random() * 6.28 });
      }
    };
    let t = 0, last = performance.now();
    const draw = (now: number) => {
      if (!alive) return;
      const dt = Math.min(50, now - last); last = now; t += dt / 1000;
      const sy = scrollY; x.clearRect(0, 0, W, H); x.lineCap = "round";
      for (const p of ps) {
        if (!reduce) p.x += p.vx * dt * (0.3 + p.z);
        if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
        const span = H * 1.6, y = (((p.y - sy * (0.02 + p.z * 0.07)) % span) + span) % span - H * 0.3;
        if (y < -20 || y > H + 20) continue;
        const tw = reduce ? 1 : 0.75 + 0.25 * Math.sin(t * 0.8 + p.ph);
        x.strokeStyle = p.cool ? `rgba(160,175,255,${p.a * tw})` : `rgba(255,255,255,${p.a * tw * 0.8})`;
        x.lineWidth = 0.9 + p.z * 1.1;
        const dx = Math.cos(p.ang) * p.len, dy = Math.sin(p.ang) * p.len;
        x.beginPath(); x.moveTo(p.x - dx / 2, y - dy / 2); x.lineTo(p.x + dx / 2, y + dy / 2); x.stroke();
      }
      g.style.transform = `translate3d(0,${(-sy * 0.04).toFixed(1)}px,0)`;
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    init();
    const onResize = () => { init(); if (reduce) draw(performance.now()); };
    const onScroll = () => draw(performance.now());
    addEventListener("resize", onResize);
    if (reduce) { draw(performance.now()); addEventListener("scroll", onScroll, { passive: true }); }
    else raf = requestAnimationFrame(draw);
    return () => { alive = false; cancelAnimationFrame(raf); removeEventListener("resize", onResize); removeEventListener("scroll", onScroll); };
  }, []);
  return (
    <>
      <div className="glowbg" aria-hidden="true" ref={gRef} />
      <canvas id="amb" aria-hidden="true" ref={cRef} />
    </>
  );
}
