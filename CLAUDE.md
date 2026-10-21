# Svitlo Plaza — сайт svitloplaza.store

- Відповідати власнику українською, коротко.
- Стек: Next.js 16 (App Router) + Supabase (проєкт svitlo-site, id teidqxvftoihhwmubiyf) + хостинг Cloudflare Workers через OpenNext (`npm run deploy`, конфіг wrangler.jsonc).
- Адресу товару `/p/{код у нижньому регістрі}` НЕ змінювати — на неї ведуть QR-коди друкованих PDF-каталогів.
- Дизайн — за брендбуком Svitlo Plaza (кольори --sp-*, Inter Tight + крапковий шрифт для цифр). Головна — з ефектами; каталог і товар — стримано й швидко.
- Дані каталогу — таблиці series/models/variants; налаштування — site_settings (matterport, showroom); соцмережі — social_accounts/social_posts. Типові задачі — у README.md.
- Секрети (SUPABASE_SECRET_KEY тощо) — лише в змінних середовища Cloudflare, ніколи в коді.
