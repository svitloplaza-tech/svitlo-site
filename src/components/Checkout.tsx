"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { readCart, writeCart, type CartItem } from "@/lib/cart";
import { cardPhoto, fmt } from "@/lib/catalog";

type Opt = { ref: string; name: string };
type Pay = { mono: boolean; cod: boolean; iban: boolean };
type Delivery = "np_wh" | "np_pm" | "np_courier" | "pickup";

const DELIVERY: { id: Delivery; name: string; note: string }[] = [
  { id: "np_wh", name: "Нова Пошта — відділення", note: "1–3 дні, за тарифами перевізника" },
  { id: "np_pm", name: "Нова Пошта — поштомат", note: "для невеликих посилок" },
  { id: "np_courier", name: "Нова Пошта — кур'єр", note: "доставка за адресою" },
  { id: "pickup", name: "Самовивіз із шоуруму", note: "безкоштовно, після підтвердження" },
];
const PAYMENT: { id: keyof Pay; name: string; note: string }[] = [
  { id: "mono", name: "Онлайн-оплата", note: "Карткою через plata by mono: Apple Pay, Google Pay, будь-яка картка" },
  { id: "cod", name: "Накладений платіж", note: "Оплата у відділенні Нової Пошти при отриманні (комісія пошти — за тарифом НП)" },
  { id: "iban", name: "Оплата за реквізитами", note: "Номер рахунку IBAN надішлемо після підтвердження замовлення" },
];

/** Пошук із підказками (місто / відділення) */
function Picker({ label, value, onPick, load, disabled, placeholder }: {
  label: string; value: Opt | null; onPick: (o: Opt | null) => void; load: (q: string) => Promise<Opt[]>; disabled?: boolean; placeholder: string;
}) {
  const [q, setQ] = useState(value?.name ?? ""), [list, setList] = useState<Opt[]>([]), [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => setQ(value?.name ?? ""), [value]);
  const run = (s: string) => { clearTimeout(t.current); t.current = setTimeout(async () => { setBusy(true); setList(await load(s).catch(() => [])); setBusy(false); }, 250); };
  return (
    <label className="ck-f ck-pick">
      <span className="sr">{label}</span>
      <input value={q} disabled={disabled} placeholder={placeholder} autoComplete="off"
        onFocus={() => { setOpen(true); run(q === value?.name ? "" : q); }} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQ(e.target.value); onPick(null); setOpen(true); run(e.target.value); }} />
      <i className="req">*</i>
      {open && !disabled && (
        <ul className="ck-list" role="listbox">
          {busy && !list.length ? <li className="mute">Шукаємо…</li> : !list.length ? <li className="mute">{q.length < 2 && label === "Місто" ? "Почніть вводити назву" : "Нічого не знайдено"}</li>
            : list.slice(0, 60).map((o) => <li key={o.ref} role="option" aria-selected={o.ref === value?.ref} onMouseDown={(e) => { e.preventDefault(); onPick(o); setQ(o.name); setOpen(false); }}>{o.name}</li>)}
        </ul>
      )}
    </label>
  );
}

export default function Checkout({ pay, showroom }: { pay: Pay; showroom: string | null }) {
  const [items, setItems] = useState<CartItem[] | null>(null);
  useEffect(() => setItems(readCart()), []);
  const upd = (next: CartItem[]) => { setItems(next); writeCart(next); };
  const [f, setF] = useState({ last_name: "", first_name: "", phone: "+380", email: "", comment: "", street: "", house: "", flat: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const [dlv, setDlv] = useState<Delivery | "">(""), [pm, setPm] = useState<keyof Pay | "">("");
  const [city, setCity] = useState<Opt | null>(null), [wh, setWh] = useState<Opt | null>(null);
  const [err, setErr] = useState(""), [sending, setSending] = useState(false), [tried, setTried] = useState(false);

  const count = (items ?? []).reduce((s, i) => s + i.qty, 0);
  const total = (items ?? []).reduce((s, i) => s + (i.price ?? 0) * i.qty, 0);
  const phoneOk = /^\+380\d{9}$/.test(f.phone.replace(/[\s()-]/g, ""));
  const np = dlv.startsWith("np");
  const dlvOk = dlv === "pickup" || (dlv === "np_courier" ? !!city && !!f.street.trim() && !!f.house.trim() : np && !!city && !!wh);
  const valid = !!items?.length && f.last_name.trim() && f.first_name.trim() && phoneOk && dlvOk && pm;
  const payOpts = useMemo(() => PAYMENT.filter((p) => pay[p.id] && !(p.id === "cod" && dlv === "pickup")), [pay, dlv]);
  useEffect(() => { if (pm && !payOpts.some((p) => p.id === pm)) setPm(""); }, [payOpts, pm]);
  useEffect(() => { if (valid && err.startsWith("Заповніть")) setErr(""); }, [valid, err]);

  const cities = (q: string) => fetch(`/api/np?op=cities&q=${encodeURIComponent(q)}`).then((r) => r.json());
  const whs = (q: string) => city ? fetch(`/api/np?op=wh&kind=${dlv === "np_pm" ? "pm" : "wh"}&city=${city.ref}&q=${encodeURIComponent(q)}`).then((r) => r.json()) : Promise.resolve([]);

  const submit = async () => {
    setTried(true); setErr("");
    if (!valid) { setErr("Заповніть поля, позначені *"); return; }
    setSending(true);
    const delivery = dlv === "pickup" ? { type: dlv, name: "Самовивіз із шоуруму", address: showroom }
      : { type: dlv, name: DELIVERY.find((d) => d.id === dlv)!.name, city: city!.name, city_ref: city!.ref,
          ...(dlv === "np_courier" ? { street: f.street.trim(), house: f.house.trim(), flat: f.flat.trim() } : { warehouse: wh!.name, warehouse_ref: wh!.ref }) };
    const r = await fetch("/api/order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      last_name: f.last_name, first_name: f.first_name, phone: f.phone, email: f.email, comment: f.comment, payment: pm, delivery,
      items: items!.map((i) => ({ sku: i.sku, qty: i.qty })) }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok || !j.redirect) { setSending(false); setErr(j.error ?? "Немає зв'язку, спробуйте ще раз"); return; }
    writeCart([]);
    location.href = j.redirect;
  };

  if (items === null) return null;
  if (!items.length) return <div className="empty-note">Кошик порожній. <Link href="/katalog" style={{ color: "var(--sp-warm)" }}>Перейти до каталогу</Link></div>;
  const bad = (ok: unknown) => (tried && !ok ? " bad" : "");

  return (
    <div className="ck">
      <section className="ck-col">
        <h2>Анкета отримувача</h2>
        <label className={"ck-f" + bad(f.last_name.trim())}><span className="sr">Прізвище</span><input value={f.last_name} onChange={set("last_name")} placeholder="Прізвище" autoComplete="family-name" /><i className="req">*</i></label>
        <label className={"ck-f" + bad(f.first_name.trim())}><span className="sr">Ім'я</span><input value={f.first_name} onChange={set("first_name")} placeholder="Ім'я" autoComplete="given-name" /><i className="req">*</i></label>
        <label className={"ck-f" + bad(phoneOk)}><span className="sr">Телефон</span><input value={f.phone} onChange={set("phone")} placeholder="+380 __ ___ __ __" inputMode="tel" autoComplete="tel" /><i className="req">*</i></label>
        <label className="ck-f"><span className="sr">Email</span><input value={f.email} onChange={set("email")} placeholder="Email (необов'язково)" inputMode="email" autoComplete="email" /></label>
        <label className="ck-f"><span className="sr">Коментар</span><textarea value={f.comment} onChange={set("comment")} placeholder="Коментар до замовлення" rows={4} /></label>
      </section>

      <section className="ck-col">
        <h2>Доставка</h2>
        <div className={"ck-opts" + bad(dlv)} role="radiogroup" aria-label="Спосіб доставки">
          {DELIVERY.map((d) => (
            <button key={d.id} type="button" role="radio" aria-checked={dlv === d.id} className="ck-opt" onClick={() => { setDlv(d.id); setWh(null); }}>
              <b>{d.name}</b><small>{d.id === "pickup" && showroom ? showroom : d.note}</small>
            </button>
          ))}
        </div>
        {np && <div className={"ck-sub" + bad(city)}><Picker label="Місто" placeholder="Місто або село" value={city} onPick={(o) => { setCity(o); setWh(null); }} load={cities} /></div>}
        {(dlv === "np_wh" || dlv === "np_pm") && (
          <div className={"ck-sub" + bad(wh)}><Picker key={dlv + city?.ref} label="Відділення" disabled={!city} placeholder={!city ? "Спершу оберіть місто" : dlv === "np_pm" ? "Номер або адреса поштомата" : "Номер або адреса відділення"} value={wh} onPick={setWh} load={whs} /></div>
        )}
        {dlv === "np_courier" && city && (
          <div className="ck-row">
            <label className={"ck-f" + bad(f.street.trim())}><input value={f.street} onChange={set("street")} placeholder="Вулиця" autoComplete="address-line1" /><i className="req">*</i></label>
            <label className={"ck-f ck-s" + bad(f.house.trim())}><input value={f.house} onChange={set("house")} placeholder="Буд." /><i className="req">*</i></label>
            <label className="ck-f ck-s"><input value={f.flat} onChange={set("flat")} placeholder="Кв." /></label>
          </div>
        )}

        <h2>Оплата</h2>
        <div className={"ck-opts" + bad(pm)} role="radiogroup" aria-label="Спосіб оплати">
          {payOpts.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={pm === p.id} className="ck-opt" onClick={() => setPm(p.id)}>
              <b>{p.name}{p.id === "mono" && <em className="ck-mono">plata by mono</em>}</b><small>{p.note}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="ck-col ck-sum">
        <h2>Вміст замовлення</h2>
        <div className="ck-items">
          {items.map((it) => (
            <div key={it.sku} className="ck-item">
              <Link href={`/p/${it.code.toLowerCase()}`} className="ph">{it.photo && <img src={cardPhoto(it.photo)!} alt="" loading="lazy" />}</Link>
              <div className="ck-it-b">
                <small>Артикул: {it.sku}</small>
                <Link href={`/p/${it.code.toLowerCase()}`}>{it.title}</Link>
                {it.variant && <small>{it.variant}</small>}
                <div className="ck-it-f">
                  <div className="qty">
                    <button type="button" aria-label="Менше" onClick={() => upd(items.map((x) => x.sku === it.sku ? { ...x, qty: Math.max(1, x.qty - 1) } : x))}>−</button>
                    <span className="dotnum">{it.qty}</span>
                    <button type="button" aria-label="Більше" onClick={() => upd(items.map((x) => x.sku === it.sku ? { ...x, qty: Math.min(99, x.qty + 1) } : x))}>+</button>
                  </div>
                  <b className="ck-pr">{it.price != null ? <>{fmt(it.price * it.qty)} <small>₴</small></> : "за запитом"}</b>
                  <button type="button" className="ck-del" aria-label="Видалити з кошика" onClick={() => upd(items.filter((x) => x.sku !== it.sku))}>
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10M6 4V2.5h4V4M4.5 4l.6 9.5h5.8l.6-9.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" /></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <dl className="ck-tot">
          <div><dt>Кількість товарів</dt><dd>{count} шт</dd></div>
          <div><dt>Доставка</dt><dd>{dlv === "pickup" ? "безкоштовно" : "за тарифами НП"}</dd></div>
          <div className="big"><dt>Сума</dt><dd className="dotnum">{fmt(total)} <small>₴</small></dd></div>
        </dl>
        {err && <p className="ck-err" role="alert">{err}</p>}
        <button type="button" className="btn btn-main ck-go" onClick={submit} disabled={sending}>
          {sending ? "Оформлюємо…" : pm === "mono" ? "Оформити й оплатити" : "Оформити замовлення"}
        </button>
        <p className="ck-note">Натискаючи кнопку, ви погоджуєтеся з умовами <a href="/dostavka" target="_blank">доставки</a>, <a href="/povernennia" target="_blank">повернення</a> та <a href="/konfidentsiinist" target="_blank">політикою конфіденційності</a>. Менеджер зателефонує для підтвердження.</p>
      </section>
    </div>
  );
}
