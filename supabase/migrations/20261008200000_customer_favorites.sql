-- Обране клієнта: зірочка на товарі → вкладка «Обране» в кабінеті.
-- Гість тримає обране в localStorage; після входу воно зливається сюди (див. src/features/favorites).
-- Кожен клієнт бачить і змінює лише свої рядки. Товар видалили назавжди — рядок зникає (cascade);
-- м'яко видалений (deleted_at) — ховає RLS products, у кабінеті його просто не показуємо.

create table if not exists public.customer_favorites (
  customer_id uuid not null references public.customers(id) on delete cascade,
  product_id  uuid not null references public.products(id)  on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (customer_id, product_id)
);

create index if not exists customer_favorites_created_idx on public.customer_favorites (customer_id, created_at desc);

alter table public.customer_favorites enable row level security;

drop policy if exists customer_favorites_read_own on public.customer_favorites;
create policy customer_favorites_read_own on public.customer_favorites for select
  using (customer_id = auth.uid());

drop policy if exists customer_favorites_insert_own on public.customer_favorites;
create policy customer_favorites_insert_own on public.customer_favorites for insert
  with check (customer_id = auth.uid());

drop policy if exists customer_favorites_delete_own on public.customer_favorites;
create policy customer_favorites_delete_own on public.customer_favorites for delete
  using (customer_id = auth.uid());

revoke all on public.customer_favorites from anon;
grant select, insert, delete on public.customer_favorites to authenticated;
