# svitloplaza.store — сайт Svitlo Plaza

Next.js 16 (App Router) + Supabase (проєкт **svitlo-site**, eu-central-1). Адмініструється через Claude Code.

## Сторінки
| Адреса | Що це |
|---|---|
| `/` | Головна: дві сфери SP-P1228 вмикаються під час прокрутки, температура світла, каталог, типи |
| `/katalog`, `/katalog/{тип}` | Каталог за типами (lyustry, pidvisni, bra, stelovi, nastilni, torshery, vulychni) з фільтрами |
| `/p/{код}` | Товар. **Адреса з QR-кодів PDF-каталогу — не змінювати** |
| `/seriya/{s101}` | Серія |
| `/3d-tur` | 3D-тур Matterport (вмикається в налаштуваннях) |
| `/sotsmerezhi` | Ми в соцмережах (блоки можна перенести на головну) |
| `/shourum`, `/koshyk`, `/poshuk` | Шоурум, кошик, пошук |

## Типові задачі (попросіть Claude Code)
- **Увімкнути 3D-тур:** у таблиці `site_settings` для ключа `matterport` записати `{"enabled": true, "model_id": "<m з посилання my.matterport.com/show/?m=...>"}`.
- **Соцмережі:** додати рядки в `social_accounts` (network, handle, url) і `social_posts` (url, image, caption, show_on_home).
- **Контакти шоуруму:** `site_settings` → `showroom` (`address`, `hours`, `phone`).
- **Ціни / наявність:** таблиця `variants` (`price`, `in_stock`, `availability`). Сховати модель: `models.is_active = false`.
- **Повний переімпорт каталогу:** `scripts/import_catalog.py` (див. коментар у файлі).

## Локальний запуск
```
cp .env.example .env.local   # вписати ключі
npm install
npm run dev
```

## Далі за планом
Оформлення замовлення (Нова Пошта, plata by mono, накладений платіж → SalesDrive), фото без фону в Supabase Storage,
перенесення фото Колекції зі старого сайту, реальне фото/відео сфери наприкінці першої сцени, адмінка, щонічне оновлення цін LineF.
