-- =====================================================================
--  Акаунти клієнтів, історія замовлень за номером, час замовлення
--  1) normalize_phone(): будь-який запис номера → «0XXXXXXXXX»
--  2) orders: user_id (хто оформив, якщо був залогінений), phone_norm,
--     scheduled_date/scheduled_time (на коли — і для доставки, і для самовивозу)
--  3) customers: профіль клієнта (Google-акаунт) + номер телефону.
--     Номер вводить сам клієнт, тому він НЕ підтверджений: старі замовлення
--     за номером показуємо лише після підтвердження (адміном або автоматично,
--     коли співробітник підтвердив замовлення, оформлене з цього акаунта на цей номер).
--  4) RLS: клієнт бачить свої замовлення (+ за підтвердженим номером)
--  5) RPC для адмінки: список клієнтів зі статистикою, підтвердження номера
-- =====================================================================

-- ---------- 1) Нормалізація номера ----------
create or replace function public.normalize_phone(p text)
returns text language sql immutable as $$
  select case
    when d ~ '^380\d{9}$' then '0' || substr(d, 4)   -- +380 93 … → 093 …
    when d ~ '^80\d{9}$'  then '0' || substr(d, 3)   -- 8 093 …  → 093 …
    when d ~ '^\d{9}$'    then '0' || d              -- 93 … (без нуля) → 093 …
    else nullif(d, '')
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) s;
$$;

-- ---------- 2) Замовлення ----------
alter table public.orders
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists phone_norm text generated always as (public.normalize_phone(phone)) stored,
  add column if not exists scheduled_date date,
  add column if not exists scheduled_time time;

comment on column public.orders.user_id is 'Акаунт клієнта, з якого оформлено замовлення (null — гість).';
comment on column public.orders.scheduled_date is 'На який день замовлення (доставка/самовивіз). null — якнайшвидше (старі замовлення).';
comment on column public.orders.scheduled_time is 'На який час. null — якнайшвидше / по готовності.';

create index if not exists orders_phone_norm_idx on public.orders (phone_norm);
create index if not exists orders_user_id_idx    on public.orders (user_id);
create index if not exists orders_created_at_idx on public.orders (created_at);

-- ---------- 3) Клієнти ----------
create table if not exists public.customers (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             text,
  name              text check (char_length(name) <= 100),
  phone             text check (char_length(phone) <= 30),
  phone_norm        text generated always as (public.normalize_phone(phone)) stored,
  phone_verified_at timestamptz,
  created_at        timestamptz not null default now()
);

-- підтверджений номер може належати лише одному акаунту
create unique index if not exists customers_verified_phone_uniq
  on public.customers (phone_norm) where phone_verified_at is not null;

-- зміна номера скидає підтвердження
create or replace function public.customers_reset_verification()
returns trigger language plpgsql as $$
begin
  if public.normalize_phone(new.phone) is distinct from old.phone_norm then
    new.phone_verified_at := null;
  end if;
  return new;
end; $$;

drop trigger if exists customers_reset_verification on public.customers;
create trigger customers_reset_verification
  before update of phone on public.customers
  for each row execute function public.customers_reset_verification();

alter table public.customers enable row level security;

drop policy if exists customers_read on public.customers;
create policy customers_read on public.customers for select
  using (id = auth.uid() or public.is_staff());

drop policy if exists customers_update_own on public.customers;
create policy customers_update_own on public.customers for update
  using (id = auth.uid()) with check (id = auth.uid());

-- клієнт може змінювати лише ім'я та номер (не підтвердження, не email)
revoke insert, update, delete on public.customers from anon, authenticated;
grant update (name, phone) on public.customers to authenticated;

-- створює профіль клієнта при першому вході (email — з auth.users, не з клієнта).
-- Реєстрація поштою передає ім'я й номер у метаданих (signUp options.data) — підхоплюємо їх;
-- Google дає full_name/name. Номер у будь-якому разі непідтверджений.
create or replace function public.customer_ensure()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.customers (id, email, name, phone)
  select u.id, u.email,
         left(nullif(trim(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')), ''), 100),
         left(nullif(trim(u.raw_user_meta_data->>'phone'), ''), 30)
  from auth.users u where u.id = auth.uid()
  on conflict (id) do nothing;
end; $$;

revoke all on function public.customer_ensure() from public;
grant execute on function public.customer_ensure() to authenticated;

-- підтверджений номер поточного користувача (для RLS)
create or replace function public.my_verified_phone()
returns text language sql stable security definer set search_path = public as $$
  select phone_norm from public.customers
  where id = auth.uid() and phone_verified_at is not null;
$$;

-- ---------- 4) RLS: клієнт бачить свої замовлення ----------
drop policy if exists orders_read_own on public.orders;
create policy orders_read_own on public.orders for select
  using (user_id = auth.uid() or phone_norm = public.my_verified_phone());

-- позиції — якщо видно саме замовлення (підзапит іде з RLS orders)
drop policy if exists order_items_read_own on public.order_items;
create policy order_items_read_own on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id));

-- ---------- Автопідтвердження номера ----------
-- Співробітник підтвердив/виконав замовлення, оформлене з акаунта на номер із профілю:
-- власник номера відповів на дзвінок і погодився — номер підтверджено.
create or replace function public.orders_autoverify_phone()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null
     and new.status in ('confirmed', 'done')
     and old.status is distinct from new.status
     and new.phone_norm is not null then
    update public.customers c set phone_verified_at = now()
    where c.id = new.user_id
      and c.phone_verified_at is null
      and c.phone_norm = new.phone_norm
      and not exists (
        select 1 from public.customers o
        where o.phone_norm = new.phone_norm and o.phone_verified_at is not null
      );
  end if;
  return null;
end; $$;

drop trigger if exists orders_autoverify_phone on public.orders;
create trigger orders_autoverify_phone
  after update of status on public.orders
  for each row execute function public.orders_autoverify_phone();

-- ---------- 5) RPC для адмінки ----------
-- Клієнти зі статистикою. «Свої» замовлення = оформлені з акаунта
-- + (якщо номер підтверджено) усі замовлення на цей номер. Скасовані не рахуємо.
-- phone_orders — скільки замовлень у базі на номер із профілю (навіть непідтверджений),
-- щоб адмін бачив, що є що привʼязати.
-- email_confirmed — пошта підтверджена (Google — одразу; email+пароль — після листа),
-- provider — як зареєструвався ('google' | 'email').
drop function if exists public.staff_customers();
create function public.staff_customers()
returns table (
  id uuid, email text, name text, phone text, phone_norm text,
  phone_verified_at timestamptz, created_at timestamptz,
  orders_count bigint, orders_total numeric, last_order_at timestamptz, phone_orders bigint,
  email_confirmed boolean, provider text
)
language sql stable security definer set search_path = public as $$
  select c.id, c.email, c.name, c.phone, c.phone_norm, c.phone_verified_at, c.created_at,
         coalesce(s.cnt, 0), coalesce(s.total, 0), s.last_at,
         (select count(*) from public.orders po where c.phone_norm is not null and po.phone_norm = c.phone_norm),
         u.email_confirmed_at is not null, u.raw_app_meta_data->>'provider'
  from public.customers c
  join auth.users u on u.id = c.id
  left join lateral (
    select count(*) as cnt, sum(o.total) as total, max(o.created_at) as last_at
    from public.orders o
    where o.status <> 'canceled'
      and (o.user_id = c.id or (c.phone_verified_at is not null and o.phone_norm = c.phone_norm))
  ) s on true
  where coalesce(public.is_staff(), false)
  order by c.created_at desc;
$$;

revoke all on function public.staff_customers() from public;
grant execute on function public.staff_customers() to authenticated;

-- Підтвердити / зняти підтвердження номера (лише staff).
-- Повертає 'ok' | 'no_phone' | 'taken' (номер уже підтверджено в іншому акаунті) | 'forbidden'.
create or replace function public.staff_set_phone_verified(customer_id uuid, verified boolean)
returns text language plpgsql security definer set search_path = public as $$
declare pn text;
begin
  -- is_staff() для не-співробітника дає NULL, а «not NULL» не спрацьовує — тому coalesce
  if not coalesce(public.is_staff(), false) then return 'forbidden'; end if;
  select phone_norm into pn from public.customers where id = customer_id;
  if not verified then
    update public.customers set phone_verified_at = null where id = customer_id;
    return 'ok';
  end if;
  if pn is null then return 'no_phone'; end if;
  if exists (select 1 from public.customers where phone_norm = pn and phone_verified_at is not null and id <> customer_id) then
    return 'taken';
  end if;
  update public.customers set phone_verified_at = coalesce(phone_verified_at, now()) where id = customer_id;
  return 'ok';
end; $$;

revoke all on function public.staff_set_phone_verified(uuid, boolean) from public;
grant execute on function public.staff_set_phone_verified(uuid, boolean) to authenticated;
