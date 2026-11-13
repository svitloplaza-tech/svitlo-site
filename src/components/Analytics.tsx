"use client";
// Аналітика: Google Analytics 4 + Microsoft Clarity з банером згоди на cookies.
// GA4 працює в Consent Mode v2: до згоди — без cookies (знеособлені сигнали), після «Прийняти» — повна статистика.
// Clarity (теплові карти, записи сеансів) вантажиться лише після згоди.
// Вибір зберігається в localStorage (sp-consent-v1). Скинути — кнопка «Налаштування cookies» у футері.
import Script from "next/script";
import Link from "next/link";
import { useEffect, useState } from "react";

import { GA_ID, CLARITY_ID, CONSENT_KEY as KEY } from "@/lib/analytics";
type Choice = "granted" | "denied" | null;

declare global {
  interface Window { dataLayer: unknown[]; gtag: (...a: unknown[]) => void; clarity?: (...a: unknown[]) => void }
}

function read(): Choice {
  try { const v = localStorage.getItem(KEY); return v === "granted" || v === "denied" ? v : null; } catch { return null; }
}

function loadClarity() {
  if (window.clarity) return;
  const q: unknown[] = [];
  const c = Object.assign((...a: unknown[]) => { q.push(a); }, { q });
  window.clarity = c;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.clarity.ms/tag/${CLARITY_ID}`;
  document.head.appendChild(s);
  window.clarity!("consent");
}

function apply(v: "granted" | "denied") {
  const st = v === "granted" ? "granted" : "denied";
  window.gtag?.("consent", "update", { analytics_storage: st, ad_storage: st, ad_user_data: st, ad_personalization: st });
  if (v === "granted") loadClarity();
}

export default function Analytics() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const c = read();
    if (c) apply(c); else setShow(true);
    const reopen = () => setShow(true);
    window.addEventListener("sp-consent-open", reopen);
    return () => window.removeEventListener("sp-consent-open", reopen);
  }, []);

  const choose = (v: "granted" | "denied") => {
    try { localStorage.setItem(KEY, v); } catch {}
    apply(v);
    setShow(false);
  };

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      {show && (
        <div className="consent" role="dialog" aria-label="Згода на cookies">
          <p>Ми використовуємо cookies для статистики відвідувань, щоб робити сайт зручнішим. <Link href="/konfidentsiinist">Детальніше</Link></p>
          <div className="consent-btns">
            <button type="button" className="consent-no" onClick={() => choose("denied")}>Відхилити</button>
            <button type="button" className="consent-yes" onClick={() => choose("granted")}>Прийняти</button>
          </div>
        </div>
      )}
    </>
  );
}

export function ConsentLink() {
  return <button type="button" className="consent-link" onClick={() => window.dispatchEvent(new Event("sp-consent-open"))}>Налаштування cookies</button>;
}
