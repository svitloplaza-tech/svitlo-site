-- Пошук за фото: «відбитки» (вектори embeddinggemma-2, 768) усіх фото каталогу.
-- Наповнює Edge-функція photo-index (pg_cron кожні 10 хв), шукає photo-search.
create extension if not exists vector with schema extensions;

create table if not exists public.photo_vectors (
  url text primary key,
  model_code text not null references public.models(code) on delete cascade,
  src text not null,                       -- photo | variant | interior | ai
  emb extensions.vector(768),
  error text,
  tries int not null default 0,
  updated_at timestamptz not null default now()
);
-- ~8 тис. фото: точний перебір швидкий і точніший за HNSW; індекс додати, якщо фото стане >50 тис.
create index if not exists photo_vectors_todo on public.photo_vectors (updated_at) where emb is null;
alter table public.photo_vectors enable row level security;  -- без політик: доступ лише service_role

-- журнал запитів для обмеження частоти (публічний пошук)
create table if not exists public.photo_search_log (ip text not null, at timestamptz not null default now());
create index if not exists photo_search_log_ip on public.photo_search_log (ip, at);
alter table public.photo_search_log enable row level security;

-- Синхронізувати список фото з каталогом: нові додати, зниклі прибрати. Повертає к-сть фото без відбитка.
create or replace function public.photo_vectors_sync() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  create temp table _p on commit drop as
  select distinct on (url) url, model_code, src from (
    select m.photo url, m.code model_code, 'photo' src, 1 o from models m where m.is_active and m.photo is not null
    union all select m.photo_interior, m.code, 'interior', 2 from models m where m.is_active and m.photo_interior is not null
    union all select v.photo, v.model_code, 'variant', 3 from variants v join models m on m.code = v.model_code
      where v.is_active and m.is_active and v.photo is not null
    union all select a, m.code, 'ai', 4 from models m, unnest(m.photos_ai) a where m.is_active and a is not null
  ) x where url <> '' order by url, o;
  delete from photo_vectors p where not exists (select 1 from _p where _p.url = p.url);
  insert into photo_vectors (url, model_code, src) select url, model_code, src from _p on conflict (url) do nothing;
  select count(*) into n from photo_vectors where emb is null and tries < 3;
  return n;
end $$;

-- Найсхожіші моделі: найкраща схожість серед усіх фото моделі.
create or replace function public.photo_match_top(q extensions.vector(768), n int default 24)
returns table (model_code text, score real, url text)
language sql stable security definer set search_path = public, extensions as $$
  select * from (
    select distinct on (model_code) model_code, score, url from (
      select model_code, (1 - (emb <=> q))::real score, url from photo_vectors
      where emb is not null order by emb <=> q limit 400
    ) t order by model_code, score desc
  ) b order by score desc limit n
$$;

-- Ліміт: не більше 20 пошуків з однієї IP за 10 хв. true = можна.
create or replace function public.photo_search_allow(p_ip text) returns boolean
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  delete from photo_search_log where at < now() - interval '1 day';
  select count(*) into c from photo_search_log where ip = p_ip and at > now() - interval '10 minutes';
  if c >= 20 then return false; end if;
  insert into photo_search_log (ip) values (p_ip);
  return true;
end $$;

revoke all on function public.photo_vectors_sync(), public.photo_match_top(extensions.vector, int),
  public.photo_search_allow(text) from public, anon, authenticated;

-- Запуск індексації
create or replace function public.photo_index_dispatch() returns void
language plpgsql security definer set search_path = public as $$
declare sec text;
begin
  select decrypted_secret into sec from vault.decrypted_secrets where name = 'order_notify_secret';
  perform net.http_post(
    url := 'https://teidqxvftoihhwmubiyf.supabase.co/functions/v1/photo-index',
    headers := jsonb_build_object('content-type', 'application/json', 'x-notify-secret', sec),
    body := '{}'::jsonb, timeout_milliseconds := 140000);
end $$;
revoke all on function public.photo_index_dispatch() from public, anon, authenticated;
select cron.schedule('photo-index', '*/10 * * * *', 'select public.photo_index_dispatch()');
