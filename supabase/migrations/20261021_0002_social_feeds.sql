-- Соцмережі: автостріччка (Edge-функція social-sync, щоночі 01:10 UTC через pg_cron) + ручна добірка.
alter table social_accounts
  add column if not exists feed boolean not null default false,   -- true = тягнути пости автоматично
  add column if not exists feed_id text,                          -- YouTube: UC…, Telegram: ім'я каналу, IG: id акаунта, FB: id сторінки
  add column if not exists synced_at timestamptz,
  add column if not exists sync_error text;
create unique index if not exists social_accounts_network_uq on social_accounts(network);
alter table social_posts
  add column if not exists external_id text,
  add column if not exists source text not null default 'manual', -- manual | auto
  add column if not exists media text not null default 'image',   -- image | video
  add column if not exists created_at timestamptz not null default now();
alter table social_posts alter column sort set default 100;        -- ручні (100) показуються перед автоматичними (1000)
alter table social_posts add constraint social_posts_ext_uq unique (network, external_id);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social', 'social', true, 5242880, array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;
create extension if not exists pg_cron;
create or replace function public.social_sync_dispatch() returns void language plpgsql security definer set search_path = public as $$
declare sec text;
begin
  select decrypted_secret into sec from vault.decrypted_secrets where name = 'order_notify_secret';
  perform net.http_post(url := 'https://teidqxvftoihhwmubiyf.supabase.co/functions/v1/social-sync',
    headers := jsonb_build_object('content-type', 'application/json', 'x-notify-secret', sec), body := '{}'::jsonb, timeout_milliseconds := 120000);
end $$;
revoke all on function public.social_sync_dispatch() from public, anon, authenticated;
select cron.schedule('social-sync', '10 1 * * *', 'select public.social_sync_dispatch()');
