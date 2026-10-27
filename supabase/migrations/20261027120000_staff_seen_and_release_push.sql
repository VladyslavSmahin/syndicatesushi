-- «Непереглянуте» для числа на іконці «SS Адмінка» і пуш про нову версію («Що нового»).
-- staff_seen: до якого моменту співробітник переглянув замовлення (відкрив дошку) і яку версію
-- «Що нового» вже бачив. release_push_log: про які версії пуш уже розіслано (рівно один раз).
-- Обидві таблиці пише й читає лише сервер (service role) — клієнтам доступу немає.
-- Застосовувати через SQL Editor (див. STATUS.md: db push у проєкті не використовується).

create table if not exists public.staff_seen (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  orders_seen_at timestamptz not null default now(),
  seen_version   text,
  updated_at     timestamptz not null default now()
);

alter table public.staff_seen enable row level security;
revoke all on public.staff_seen from anon, authenticated;
grant all on public.staff_seen to service_role;

create table if not exists public.release_push_log (
  version text primary key,
  sent_at timestamptz not null default now()
);

alter table public.release_push_log enable row level security;
revoke all on public.release_push_log from anon, authenticated;
grant all on public.release_push_log to service_role;
