-- =============================================================================
--  Sushi Syndicate — початкова схема
--  Відповідає ARCHITECTURE.md §4–§5. Створює таблиці, ролі, RLS та тригери.
-- =============================================================================

create extension if not exists pgcrypto;

-- =====================================================================
--  ДОВІДКОВІ / КОНТЕНТ
-- =====================================================================

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  sort_order  int  not null default 0,
  show_in_nav boolean not null default true,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.ingredients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  is_allergen boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.products (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid references public.categories(id) on delete set null,
  name         text not null,
  slug         text not null unique,
  short_desc   text,
  full_desc    text,
  composition  text,
  price        numeric(10,2) not null default 0,
  weight       text,
  pieces       text,
  badge        text check (badge in ('ХІТ','НОВЕ') or badge is null),
  is_hit       boolean not null default false,
  image_path   text,
  is_available boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

-- товар ↔ інгредієнт (M:N) — ключ до фільтрації каталогу
create table public.product_ingredients (
  product_id    uuid not null references public.products(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  primary key (product_id, ingredient_id)
);

-- акції / товар тижня (накладаються на категорію)
create table public.promos (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products(id) on delete cascade,
  label             text,
  title             text,
  promo_price       numeric(10,2) not null,
  old_price         numeric(10,2),
  banner_image_path text,
  valid_from        timestamptz,
  valid_until       timestamptz,
  is_active         boolean not null default true,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now()
);

create table public.promo_codes (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  discount_type  text not null check (discount_type in ('percent','fixed')),
  discount_value numeric(10,2) not null,
  is_active      boolean not null default true,
  valid_until    timestamptz,
  usage_limit    int,
  used_count     int not null default 0,
  created_at     timestamptz not null default now()
);

create table public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- =====================================================================
--  ЗАМОВЛЕННЯ / ВІДГУКИ
-- =====================================================================

create table public.orders (
  id            uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone         text not null,
  delivery_type text not null check (delivery_type in ('delivery','pickup')),
  address       text,
  comment       text,
  status        text not null default 'new' check (status in ('new','confirmed','done','canceled')),
  subtotal      numeric(10,2) not null default 0,
  promo_code_id uuid references public.promo_codes(id) on delete set null,
  discount      numeric(10,2) not null default 0,
  delivery_cost numeric(10,2) not null default 0,
  total         numeric(10,2) not null default 0,
  created_at    timestamptz not null default now()
);

create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  product_id   uuid references public.products(id) on delete set null,
  product_name text not null,           -- знімок назви на момент замовлення
  price        numeric(10,2) not null,  -- знімок ціни
  quantity     int not null check (quantity > 0)
);

create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  author_name text not null,
  contact     text not null,
  rating      int check (rating between 1 and 5),
  text        text not null,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at  timestamptz not null default now()
);

-- =====================================================================
--  РОЛІ / ДОСТУП
-- =====================================================================

-- білий список співробітників (доступ в адмінку)
create table public.allowed_staff (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  role       text not null check (role in ('admin','editor')),
  created_at timestamptz not null default now()
);

-- привʼязка авторизованого користувача до ролі
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text not null check (role in ('admin','editor')),
  created_at timestamptz not null default now()
);

-- індекси
create index on public.products (category_id);
create index on public.promos (product_id);
create index on public.order_items (order_id);

-- =====================================================================
--  ХЕЛПЕРИ ДЛЯ РОЛЕЙ
-- =====================================================================

create or replace function public.user_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable as $$ select public.user_role() = 'admin'; $$;

create or replace function public.is_staff()
returns boolean language sql stable as $$ select public.user_role() in ('admin','editor'); $$;

-- updated_at для settings
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

-- автостворення профілю при першому вході (лише якщо email у білому списку)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text;
begin
  select role into r from public.allowed_staff where lower(email) = lower(new.email);
  if r is null then
    return new; -- немає у білому списку → профіль не створюється, доступу немає
  end if;
  insert into public.profiles (id, email, role)
  values (new.id, new.email, r)
  on conflict (id) do update set role = excluded.role;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
--  RLS
--  Правило для контенту: читати — публічно; insert/update — staff;
--  DELETE — лише admin (editor не може видаляти).
-- =====================================================================

alter table public.categories          enable row level security;
alter table public.ingredients          enable row level security;
alter table public.products             enable row level security;
alter table public.product_ingredients  enable row level security;
alter table public.promos               enable row level security;
alter table public.promo_codes          enable row level security;
alter table public.settings             enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.reviews              enable row level security;
alter table public.allowed_staff        enable row level security;
alter table public.profiles             enable row level security;

-- ---- Контент із публічним читанням ----
do $$
declare t text;
begin
  foreach t in array array['categories','ingredients','products','product_ingredients'] loop
    execute format('create policy %I_read   on public.%I for select using (true);', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (public.is_staff());', t, t);
    execute format('create policy %I_update on public.%I for update using (public.is_staff()) with check (public.is_staff());', t, t);
    execute format('create policy %I_delete on public.%I for delete using (public.is_admin());', t, t);
  end loop;
end $$;

-- ---- promos: публічно лише активні ----
create policy promos_read   on public.promos for select using (is_active or public.is_staff());
create policy promos_insert on public.promos for insert with check (public.is_staff());
create policy promos_update on public.promos for update using (public.is_staff()) with check (public.is_staff());
create policy promos_delete on public.promos for delete using (public.is_admin());

-- ---- promo_codes: без публічного читання (перевірка лише на сервері/service role) ----
create policy promo_codes_read   on public.promo_codes for select using (public.is_staff());
create policy promo_codes_insert on public.promo_codes for insert with check (public.is_staff());
create policy promo_codes_update on public.promo_codes for update using (public.is_staff()) with check (public.is_staff());
create policy promo_codes_delete on public.promo_codes for delete using (public.is_admin());

-- ---- settings: публічне читання, запис лише staff ----
create policy settings_read   on public.settings for select using (true);
create policy settings_insert on public.settings for insert with check (public.is_staff());
create policy settings_update on public.settings for update using (public.is_staff()) with check (public.is_staff());

-- ---- orders / order_items: читання/зміна — staff, видалення — admin ----
--   (створення замовлення йде через серверний action із service-role ключем,
--    який обходить RLS; публічний insert не відкриваємо)
create policy orders_read   on public.orders for select using (public.is_staff());
create policy orders_update on public.orders for update using (public.is_staff()) with check (public.is_staff());
create policy orders_delete on public.orders for delete using (public.is_admin());

create policy order_items_read on public.order_items for select using (public.is_staff());

-- ---- reviews: публічно лише approved; вставка публічна зі статусом pending ----
create policy reviews_read   on public.reviews for select using (status = 'approved' or public.is_staff());
create policy reviews_insert on public.reviews for insert with check (status = 'pending');
create policy reviews_update on public.reviews for update using (public.is_staff()) with check (public.is_staff());
create policy reviews_delete on public.reviews for delete using (public.is_admin());

-- ---- allowed_staff: лише admin ----
create policy allowed_staff_all on public.allowed_staff for all using (public.is_admin()) with check (public.is_admin());

-- ---- profiles: користувач бачить себе; admin — усіх ----
create policy profiles_read   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update using (public.is_admin()) with check (public.is_admin());
