"use client";
// Кнопки зв'язку на картці товару: Viber, Telegram, WhatsApp, дзвінок.
// Кожен клік — подія «contact» у Google Analytics (method = канал) і подія у Clarity, щоб рахувати звернення як заявки.
import { SHOP_PHONE } from "@/lib/brand";

type Props = { code: string; title: string; url: string };

function track(method: string, code: string) {
  try { window.gtag?.("event", "contact", { method, item_id: code }); } catch {}
  try { window.clarity?.("event", `contact_${method}`); } catch {}
}

export default function ContactButtons({ code, title, url }: Props) {
  const text = `Вітаю! Цікавить ${code} (${title}) — ${url}`;
  const num = SHOP_PHONE.replace("+", "");
  const links = [
    { m: "viber", label: "Viber", href: `viber://chat?number=%2B${num}&draft=${encodeURIComponent(text)}`, ext: false },
    { m: "telegram", label: "Telegram", href: `https://t.me/${SHOP_PHONE}`, ext: true },
    { m: "whatsapp", label: "WhatsApp", href: `https://wa.me/${num}?text=${encodeURIComponent(text)}`, ext: true },
    { m: "phone", label: "Дзвінок", href: `tel:${SHOP_PHONE}`, ext: false },
  ];
  return (
    <div className="contact-btns">
      <span>Запитати про товар</span>
      <div>
        {links.map((l) => (
          <a key={l.m} className={`cb cb-${l.m}`} href={l.href} {...(l.ext ? { target: "_blank", rel: "noopener" } : {})} onClick={() => track(l.m, code)}>{l.label}</a>
        ))}
      </div>
    </div>
  );
}
