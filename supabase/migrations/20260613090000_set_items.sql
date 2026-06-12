-- Склад сету = товари (роли). Зв'язок set(product) -> roll(product).
-- Створюється напряму на проді (workflow проєкту: SQL застосовуємо вручну, не через db push).

create table if not exists public.set_items (
  set_id     uuid not null references public.products(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  qty        int  not null default 1,
  sort_order int  not null default 0,
  primary key (set_id, product_id)
);
create index if not exists set_items_set_idx on public.set_items(set_id);

alter table public.set_items enable row level security;

-- Дзеркалимо правила product_ingredients: читати публічно, писати — staff, видаляти — admin.
do $$ begin create policy set_items_read   on public.set_items for select using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy set_items_insert on public.set_items for insert with check (public.is_staff()); exception when duplicate_object then null; end $$;
do $$ begin create policy set_items_update on public.set_items for update using (public.is_staff()) with check (public.is_staff()); exception when duplicate_object then null; end $$;
do $$ begin create policy set_items_delete on public.set_items for delete using (public.is_admin()); exception when duplicate_object then null; end $$;
