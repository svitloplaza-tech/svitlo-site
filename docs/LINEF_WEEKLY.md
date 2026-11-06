# Щотижневе оновлення LineF (рішення власника 06.11.2026: раз на тиждень)

Запускає запланована задача «LineF: наявність щотижня» (понеділок ~03:47 за Києвом).

1. `pip install requests --break-system-packages` (якщо треба) і `python3 scripts/linef_stock.py scrape` (≈15–25 хв).
2. SQL (Supabase, проєкт teidqxvftoihhwmubiyf):
   ```sql
   create table if not exists public.tmp_stock(sku text primary key, qty int, exp boolean, price int);
   alter table public.tmp_stock enable row level security;
   drop policy if exists tmp_ins on public.tmp_stock;
   create policy tmp_ins on public.tmp_stock for insert to anon with check (true);
   grant insert on public.tmp_stock to anon;
   ```
3. `python3 scripts/linef_stock.py upload`
4. SQL — оновити наявність І ЦІНИ (рішення власника 06.11) та прибрати тимчасове.
   Ціна LineF = роздріб LineF (price = price_supplier). Зміну ціни більш ніж удвічі (або менш ніж наполовину) НЕ застосовувати — лише показати у звіті як підозрілу.
   Якщо нова ціна ≥ old_price (закреслена), old_price обнулити, щоб не показувати неіснуючу знижку. Ціни Колекції (supplier ≠ LineF) не чіпати.
   ```sql
   with x as (select sku, case when qty>0 then 'В наявності' when exp then 'Очікується' else 'Немає в наявності' end a, qty>0 s, price from tmp_stock),
   st as (update variants v set availability=x.a, in_stock=x.s, updated_at=now() from x
          where v.sku=x.sku and v.supplier='LineF' and (v.availability is distinct from x.a or v.in_stock<>x.s) returning x.a),
   cand as (select v.sku, v.price old, x.price new from x join variants v using(sku)
            where v.supplier='LineF' and x.price is not null and x.price>0 and v.price is not null and x.price<>v.price),
   pr as (update variants v set price=c.new, price_supplier=c.new,
            old_price=case when v.old_price is not null and c.new>=v.old_price then null else v.old_price end, updated_at=now()
          from cand c where v.sku=c.sku and c.new between c.old*0.5 and c.old*2 returning c.sku, c.old, c.new)
   select (select count(*) from st) stock_changed,
          (select json_object_agg(a,n) from (select a,count(*) n from st group by a) t) by_status,
          (select count(*) from pr) prices_changed,
          (select json_agg(t) from (select sku, old, new from pr order by abs(new-old) desc limit 5) t) top_price,
          (select json_agg(t) from (select * from cand where not (new between old*0.5 and old*2)) t) suspicious;
   drop table public.tmp_stock;
   ```
5. Звіт власнику: скільки змінилось наявності (з'явилось / зникло / очікується), скільки сторінок не відкрилось, скільки цін оновлено (подорожчало / подешевшало), топ-5 змін ціни, підозрілі (не застосовані).
Сайт підхоплює нові дані сам протягом ~3 год (кеш каталогу).
