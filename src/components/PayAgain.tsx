"use client";
import { useEffect, useState } from "react";

const FN = `${process.env.NEXT_PUBLIC_SUPABASE_URL || "https://teidqxvftoihhwmubiyf.supabase.co"}/functions/v1/mono-pay`;

/** Після повернення з mono: перевіряємо оплату; якщо не пройшла — кнопка «Оплатити ще раз». */
export default function PayAgain({ number, token, status }: { number: number; token: string; status: string }) {
  const [st, setSt] = useState(status), [busy, setBusy] = useState(false);
  useEffect(() => {
    let n = 0, stop = false;
    const check = async () => {
      const r = await fetch(`${FN}?check=1`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ number, token }) }).catch(() => null);
      const j = r?.ok ? await r.json() : null;
      if (j?.payment_status) setSt(j.payment_status);
      if (!stop && j?.payment_status === "pending" && ++n < 6) setTimeout(check, 4000);
    };
    check(); return () => { stop = true; };
  }, [number, token]);
  const pay = async () => {
    setBusy(true);
    const r = await fetch(FN, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ number, token, return: location.href }) }).catch(() => null);
    const j = r?.ok ? await r.json() : null;
    if (j?.pageUrl) location.href = j.pageUrl; else setBusy(false);
  };
  if (st === "paid") return <p className="thanks-paid">Оплату отримано ✓</p>;
  return (
    <div className="thanks-pay">
      <p>{st === "failed" ? "Оплата не пройшла." : "Очікуємо підтвердження оплати від банку…"}</p>
      <button type="button" className="btn btn-main" onClick={pay} disabled={busy}>{busy ? "Відкриваємо…" : "Оплатити карткою"}</button>
    </div>
  );
}
