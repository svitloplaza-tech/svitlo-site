"use client";
// Кнопки зв'язку на картці товару: Viber, Telegram, WhatsApp, дзвінок.
// Вигляд: фірмовий колір месенджера + назва зверху; при наведенні (ПК) або дотику (телефон) проявляється чорний силует символу.
// Символи — власні узагальнені (бульбашка зі слухавкою, паперовий літачок, бульбашка чату, слухавка), не офіційні логотипи.
// Кожен клік — подія «contact» у Google Analytics (method = канал) і подія у Clarity.
import { SHOP_PHONE } from "@/lib/brand";

type Props = { code: string; title: string; url: string };

function track(method: string, code: string) {
  try { window.gtag?.("event", "contact", { method, item_id: code }); } catch {}
  try { window.clarity?.("event", `contact_${method}`); } catch {}
}

const ICON: Record<string, React.ReactNode> = {
  // бульбашка з телефонною слухавкою
  viber: <path d="M12 2.5C6.8 2.5 3 5.9 3 10.6c0 2.6 1.2 4.7 3.1 6.1V21l3.4-2.3c.8.2 1.6.3 2.5.3 5.2 0 9-3.4 9-8.4S17.2 2.5 12 2.5Zm3.6 11.2-.6.6c-.6.6-2 .3-3.6-1.3s-1.9-3-1.3-3.6l.6-.6c.3-.3.8-.3 1 0l.8.9c.2.3.2.7 0 .9l-.4.4c.3.6 1.1 1.4 1.7 1.7l.4-.4c.3-.3.7-.3.9 0l.9.8c.3.3.3.7 0 1Z" />,
  // паперовий літачок
  telegram: <path d="M21.4 3.6 2.9 10.7c-.9.4-.9 1.6 0 1.9l4.6 1.6 1.8 5.6c.2.7 1.1.9 1.6.4l2.6-2.5 4.6 3.4c.6.4 1.4.1 1.6-.6l3.1-14.8c.2-.9-.6-1.6-1.4-1.1Zm-4.2 3.9-7.7 7-.3 3.2-1.3-4.2 9.3-6Z" />,
  // кругла бульбашка чату з трьома крапками
  whatsapp: <path d="M12 2.5a9.5 9.5 0 0 0-8.2 14.3L2.5 21.5l4.8-1.3A9.5 9.5 0 1 0 12 2.5Zm-4.2 10.9a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8Zm4.2 0a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8Zm4.2 0a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8Z" />,
  // телефонна слухавка
  phone: <path d="M20.5 16.4v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2.6 5.7 2 2 0 0 1 4.6 3.5h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.6 11.2a16 16 0 0 0 4.2 4.2l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" />,
};

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
          <a key={l.m} className={`cb cb-${l.m}`} href={l.href} aria-label={`${l.label}: запитати про ${code}`}
            {...(l.ext ? { target: "_blank", rel: "noopener" } : {})} onClick={() => track(l.m, code)} onTouchStart={() => {}}>
            <b>{l.label}</b>
            <svg className="cb-ic" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">{ICON[l.m]}</svg>
          </a>
        ))}
      </div>
    </div>
  );
}
