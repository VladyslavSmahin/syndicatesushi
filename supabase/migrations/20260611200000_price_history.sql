-- =============================================================================
--  Історія змін цін (аудит): одиночні та масові зміни, з можливістю відкату.
-- =============================================================================

create table if not exists public.price_history (
  id         uuid primary key default gen_random_uuid(),
  type       text not null check (type in ('single','bulk')),
  label      text not null,
  changes    jsonb not null,   -- [{ productId, name, from, to }]
  reverted   boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists price_history_created_idx on public.price_history (created_at desc);

alter table public.price_history enable row level security;
drop policy if exists price_history_read   on public.price_history;
drop policy if exists price_history_insert on public.price_history;
drop policy if exists price_history_update on public.price_history;
create policy price_history_read   on public.price_history for select using (public.is_staff());
create policy price_history_insert on public.price_history for insert with check (public.is_staff());
create policy price_history_update on public.price_history for update using (public.is_staff()) with check (public.is_staff());
