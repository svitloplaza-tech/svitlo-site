// Логотип в один рядок. Варіанти в public/brand: logo-h-lamp (лампа), logo-h-dot (тепла крапка), logo-h-mark (знак S).
// Щоб змінити логотип на сайті — змініть тут назву файлу.
export const LOGO = "/brand/logo-h-lamp.svg";

// Рейтинг магазину в Google Maps (картка «Світло Плаза», cid 321594649625484227). Оновлювати вручну; перевірено 23.11.2026.
export const GOOGLE_RATING = { value: 4.5, count: 124, url: "https://maps.google.com/?cid=321594649625484227" };
export const ratingText = (r = GOOGLE_RATING) => `${String(r.value).replace(".", ",")} · ${r.count} ${r.count % 10 === 1 && r.count % 100 !== 11 ? "відгук" : [2, 3, 4].includes(r.count % 10) && ![12, 13, 14].includes(r.count % 100) ? "відгуки" : "відгуків"} у Google`;

// Контакти для кнопок «Запитати про товар» (номер магазину; Viber/Telegram/WhatsApp прив'язані до нього — власник 26.11)
export const SHOP_PHONE = "+380983836014";
