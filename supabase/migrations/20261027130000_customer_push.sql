-- Пуш-сповіщення клієнтам сайту: статус замовлення й акції/новинки.
-- customer_push_subscriptions: один рядок = один пристрій клієнта (вмикає сам у кабінеті), прапорці —
-- на що погодився. Акції — лише з окремою згодою (notify_promos, за замовчуванням вимкнено).
-- push_broadcasts: журнал рекламних розсилок з адмінки (хто, що, скільком).
-- Пише й читає лише сервер (service role): /api/push, /api/admin/push. Клієнтам доступу немає.
-- Застосовувати через SQL Editor / session pooler (див. STATUS.md: db push у проєкті не використовується).

create table if not exists public.customer_push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  notify_orders boolean not null default true,
  notify_promos boolean not null default false,
  created_at    timestamptz not null default now(),
  last_sent_at  timestamptz
);

create index if not exists customer_push_subscriptions_user_id_idx on public.customer_push_subscriptions (user_id);

alter table public.customer_push_subscriptions enable row level security;
revoke all on public.customer_push_subscriptions from anon, authenticated;
grant all on public.customer_push_subscriptions to service_role;

create table if not exists public.push_broadcasts (
  id         uuid primary key default gen_random_uuid(),
  sent_by    uuid references public.profiles(id) on delete set null,
  title      text not null,
  body       text not null,
  url        text,
  recipients int not null default 0,
  sent       int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.push_broadcasts enable row level security;
revoke all on public.push_broadcasts from anon, authenticated;
grant all on public.push_broadcasts to service_role;
