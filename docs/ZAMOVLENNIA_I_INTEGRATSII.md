# Замовлення з сайту та інтеграції

## Як проходить замовлення
1. Покупець оформлює /koshyk → `/api/order` → функція бази `create_order` (перевіряє дані, ціни бере з `variants`).
2. `create_order` записує `orders` + `order_items` і подію `order_events (event='created')`.
3. Онлайн-оплата: Edge-функція `mono-pay` створює рахунок monobank; вебхук mono змінює `orders.payment_status` → тригер додає подію `paid` або `payment_failed`.
4. Кожна нова подія → тригер `order_events_dispatch` (pg_net) → Edge-функція `order-notify` → канали з `site_settings.notifications`. Результат кожного каналу — у `order_deliveries`.
   Замовлення зі `status='test'` подій «оплачено» не створюють.

## Канали (`site_settings` → ключ `notifications`)
```json
{ "telegram": true, "email": true, "email_to": ["svitloplaza@gmail.com"], "salesdrive": false,
  "webhooks": [ { "url": "https://crm.example/api/orders", "secret": "…", "events": ["created", "paid"] } ] }
```
Секрети Edge-функцій (Supabase → Edge Functions → Secrets):
| Канал | Секрети |
|---|---|
| Telegram | `TG_BOT_TOKEN` (від @BotFather), `TG_CHAT_ID` (кілька — через кому) |
| Email | `RESEND_API_KEY` (resend.com), `EMAIL_FROM` (після підключення домену, напр. `Svitlo Plaza <orders@svitloplaza.store>`) |
| SalesDrive | `SALESDRIVE_URL` (`https://<акаунт>.salesdrive.me/handler/`), `SALESDRIVE_KEY` (ключ форми прийому заявок) |
| Онлайн-оплата | `MONO_TOKEN` (X-Token інтернет-еквайрингу monobank) + `site_settings.payments.mono = true` |

## Власна CRM у майбутньому
Два способи, можна разом:
- **Вебхук**: додати CRM у `notifications.webhooks`. На кожну подію приходить `POST` JSON:
  `{ event, event_id, at, order: {…усі поля orders без public_token}, items: [{sku, model_code, title, variant, qty, price}] }`,
  заголовки `x-sp-event` і `x-sp-signature` = HMAC-SHA256(secret, тіло запиту) у hex. Відповідь 2xx = доставлено (повторно не шлеться).
- **Пряме читання бази**: таблиці `orders`, `order_items`, `order_events` у Supabase (сервісним ключем CRM). Статуси, які ставить сайт:
  `orders.status` new / paid / test; `orders.payment_status` none / pending / paid / failed / refunded.
