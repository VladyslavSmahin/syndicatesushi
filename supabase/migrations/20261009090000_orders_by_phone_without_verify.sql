-- Рішення власника (2026-10-09): номер у профілі НЕ потребує підтвердження адміном.
-- Клієнт бачить у кабінеті всі замовлення на номер із профілю одразу; в адмінці вони ж рахуються йому.
-- (Раніше — лише після phone_verified_at, див. 20261008120000.) Колонку phone_verified_at не видаляємо — просто не використовуємо.

-- номер поточного користувача для RLS — без умови підтвердження (назву лишаємо: на неї посилається orders_read_own)
create or replace function public.my_verified_phone()
returns text language sql stable security definer set search_path = public as $$
  select phone_norm from public.customers where id = auth.uid();
$$;

-- статистика клієнтів в адмінці: «свої» = з акаунта + усі на номер із профілю
create or replace function public.staff_customers()
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
      and (o.user_id = c.id or (c.phone_norm is not null and o.phone_norm = c.phone_norm))
  ) s on true
  where coalesce(public.is_staff(), false)
  order by c.created_at desc;
$$;

notify pgrst, 'reload schema';
