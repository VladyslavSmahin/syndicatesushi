-- Пуш-сповіщення персоналу про нові замовлення (PWA «SS Адмінка»).
-- Один рядок = один пристрій співробітника (endpoint від браузера/iOS). Вмикає сам співробітник
-- кнопкою в адмінці. Надсилає сервер (/api/order, service role); застарілі endpoint'и (404/410)
-- сервер видаляє сам.
-- Застосовувати через SQL Editor (див. STATUS.md: db push у проєкті не використовується).

create table if not exists public.staff_push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_sent_at timestamptz
);

create index if not exists staff_push_subscriptions_user_id_idx on public.staff_push_subscriptions (user_id);

alter table public.staff_push_subscriptions enable row level security;

-- співробітник бачить і керує лише своїми пристроями
drop policy if exists staff_push_select_own on public.staff_push_subscriptions;
create policy staff_push_select_own on public.staff_push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()) and (select public.is_staff()));

drop policy if exists staff_push_insert_own on public.staff_push_subscriptions;
create policy staff_push_insert_own on public.staff_push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()) and (select public.is_staff()));

drop policy if exists staff_push_delete_own on public.staff_push_subscriptions;
create policy staff_push_delete_own on public.staff_push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.staff_push_subscriptions from anon, authenticated;
grant select, insert, delete on public.staff_push_subscriptions to authenticated;
grant all on public.staff_push_subscriptions to service_role;
