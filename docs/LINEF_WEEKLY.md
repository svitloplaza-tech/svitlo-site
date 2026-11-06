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
4. SQL — оновити наявність (ЦІНИ НЕ МІНЯТИ, лише звіт) і прибрати тимчасове:
   ```sql
   with x as (select sku, case when qty>0 then 'В наявності' when exp then 'Очікується' else 'Немає в наявності' end a, qty>0 s, price from tmp_stock),
   u as (update variants v set availability=x.a, in_stock=x.s, updated_at=now() from x
         where v.sku=x.sku and v.supplier='LineF' and (v.availability is distinct from x.a or v.in_stock<>x.s) returning v.sku, x.a)
   select (select count(*) from u) changed,
          (select json_object_agg(a,n) from (select a,count(*) n from u group by a) t) by_status,
          (select count(*) from x join variants v using(sku) where x.price is not null and v.price is not null and x.price<>v.price) price_diff,
          (select json_agg(t) from (select v.sku, v.price old, x.price new from x join variants v using(sku)
             where x.price is not null and v.price is not null and x.price<>v.price order by abs(x.price-v.price) desc limit 15) t) top_price;
   drop table public.tmp_stock;
   ```
5. Звіт власнику: скільки змінилось (з'явилось / зникло), скільки сторінок не відкрилось, зміни цін LineF (топ-15).
Сайт підхоплює нові дані сам протягом ~3 год (кеш каталогу).
