-- =====================================================================
--  «Запроси друга»
--  1) customers.ref_code — особистий код клієнта (посилання /?ref=CODE або ввести як промокод)
--  2) orders.referrer_id — хто запросив (знижка другу −10% на ПЕРШЕ замовлення рахується на сервері)
--  3) customers.bonus_points — баланс балів; +10 запрошувачу, коли замовлення друга виконано (status = 'done')
--     нарахування одне на замовлення (orders.referral_points_at), скасування після «виконано» — бали знімаються
--  4) RPC: customer_ref_code() — видати/створити свій код; my_referrals() — статистика для кабінету
-- =====================================================================

alter table public.customers
  add column if not exists ref_code text,
  add column if not exists bonus_points int not null default 0;

create unique index if not exists customers_ref_code_uniq on public.customers (upper(ref_code));

alter table public.orders
  add column if not exists referrer_id uuid references public.customers(id) on delete set null,
  add column if not exists referral_points_at timestamptz;

create index if not exists orders_referrer_idx on public.orders (referrer_id);

comment on column public.customers.ref_code is 'Особистий код «Запроси друга» (друг отримує −10% на перше замовлення).';
comment on column public.customers.bonus_points is 'Бонусні бали клієнта (+10 за кожного запрошеного друга, чиє замовлення виконано).';
comment on column public.orders.referrer_id is 'Клієнт, за чиїм кодом зроблено це (перше) замовлення.';

-- ---------- Свій код: створюється при першому зверненні ----------
create or replace function public.customer_ref_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  c text;
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- без 0/O, 1/I/L
begin
  if auth.uid() is null then return null; end if;
  select ref_code into c from public.customers where id = auth.uid();
  if c is not null then return c; end if;
  if not exists (select 1 from public.customers where id = auth.uid()) then return null; end if;
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.customers where upper(ref_code) = c)
          and not exists (select 1 from public.promo_codes where upper(code) = c);
  end loop;
  update public.customers set ref_code = c where id = auth.uid() and ref_code is null;
  select ref_code into c from public.customers where id = auth.uid();
  return c;
end; $$;

revoke all on function public.customer_ref_code() from public;
grant execute on function public.customer_ref_code() to authenticated;

-- ---------- Статистика запрошень для кабінету ----------
-- friends — скільки друзів замовили за кодом (без скасованих); rewarded — за скількох уже нараховано бали
create or replace function public.my_referrals()
returns table (friends bigint, rewarded bigint, points int)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.orders o where o.referrer_id = auth.uid() and o.status <> 'canceled'),
    (select count(*) from public.orders o where o.referrer_id = auth.uid() and o.referral_points_at is not null),
    (select coalesce(bonus_points, 0) from public.customers where id = auth.uid());
$$;

revoke all on function public.my_referrals() from public;
grant execute on function public.my_referrals() to authenticated;

-- ---------- Нарахування балів запрошувачу ----------
create or replace function public.orders_referral_points()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.referrer_id is null or old.status is not distinct from new.status then return null; end if;
  if new.status = 'done' and new.referral_points_at is null then
    update public.customers set bonus_points = bonus_points + 10 where id = new.referrer_id;
    update public.orders set referral_points_at = now() where id = new.id;
  elsif new.status = 'canceled' and new.referral_points_at is not null then
    update public.customers set bonus_points = greatest(0, bonus_points - 10) where id = new.referrer_id;
    update public.orders set referral_points_at = null where id = new.id;
  end if;
  return null;
end; $$;

drop trigger if exists orders_referral_points on public.orders;
create trigger orders_referral_points
  after update of status on public.orders
  for each row execute function public.orders_referral_points();

notify pgrst, 'reload schema';
