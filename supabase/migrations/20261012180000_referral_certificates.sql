-- =====================================================================
--  «Приведи друга» — сертифікати замість балів
--  Друг: −10% на перше замовлення від 1500 грн (перевіряє сервер /api/order).
--  Запрошувач: сертифікат 100 грн на замовлення від 1000 грн, коли замовлення друга виконано (status = 'done').
--  1) customer_certificates — сертифікати клієнта (active → used / revoked)
--  2) orders.certificate_id — сертифікат, яким оплачено частину замовлення
--  3) тригер нагороди замість балів (orders_referral_points → orders_referral_reward)
--  4) скасували замовлення, оплачене сертифікатом, — сертифікат знову активний
--  5) customers.referred_by — хто запросив (фіксується при реєстрації за посиланням /?ref=CODE)
--  6) my_referrals() — список запрошених зі статусом: registered → ordered → confirmed
--     (confirmed = замовлення друга за кодом підтверджено або виконано → сертифікат)
-- =====================================================================

create table if not exists public.customer_certificates (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers(id) on delete cascade,
  amount          numeric(10,2) not null default 100,
  min_order       numeric(10,2) not null default 1000,
  status          text not null default 'active' check (status in ('active','used','revoked')),
  source_order_id uuid unique references public.orders(id) on delete set null, -- замовлення друга, за яке видано
  used_order_id   uuid references public.orders(id) on delete set null,
  created_at      timestamptz not null default now(),
  used_at         timestamptz
);
create index if not exists customer_certificates_customer_idx on public.customer_certificates (customer_id, status);

alter table public.customer_certificates enable row level security;
drop policy if exists customer_certificates_read on public.customer_certificates;
create policy customer_certificates_read on public.customer_certificates for select
  using (customer_id = auth.uid() or public.is_staff());
revoke insert, update, delete on public.customer_certificates from anon, authenticated;

comment on table public.customer_certificates is 'Сертифікати «Приведи друга»: 100 грн на замовлення від 1000 грн. Видає тригер, списує /api/order (service role).';

alter table public.orders
  add column if not exists certificate_id uuid references public.customer_certificates(id) on delete set null;

-- ---------- Нагорода запрошувачу (замість +10 балів) ----------
drop trigger if exists orders_referral_points on public.orders;
drop function if exists public.orders_referral_points();

create or replace function public.orders_referral_reward()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status is not distinct from new.status then return null; end if;

  -- замовлення друга підтверджено (або одразу виконано) → сертифікат запрошувачу (один на замовлення)
  if new.referrer_id is not null and new.status in ('confirmed', 'done') and new.referral_points_at is null then
    insert into public.customer_certificates (customer_id, source_order_id)
    values (new.referrer_id, new.id)
    on conflict (source_order_id) do update set status = 'active'
      where public.customer_certificates.status = 'revoked';
    update public.orders set referral_points_at = now() where id = new.id;
  -- замовлення друга скасували після «виконано» → невикористаний сертифікат відкликаємо
  elsif new.referrer_id is not null and new.status = 'canceled' and new.referral_points_at is not null then
    update public.customer_certificates set status = 'revoked' where source_order_id = new.id and status = 'active';
    update public.orders set referral_points_at = null where id = new.id;
  end if;

  -- скасували замовлення, оплачене сертифікатом → сертифікат знову можна використати
  if new.certificate_id is not null and new.status = 'canceled' then
    update public.customer_certificates set status = 'active', used_order_id = null, used_at = null
    where id = new.certificate_id and status = 'used' and used_order_id = new.id;
  end if;
  return null;
end; $$;

drop trigger if exists orders_referral_reward on public.orders;
create trigger orders_referral_reward
  after update of status on public.orders
  for each row execute function public.orders_referral_reward();

-- ---------- Хто запросив: фіксуємо при реєстрації ----------
alter table public.customers
  add column if not exists referred_by uuid references public.customers(id) on delete set null,
  add column if not exists referred_at timestamptz;
create index if not exists customers_referred_by_idx on public.customers (referred_by);

-- Викликає сайт після входу, якщо людина прийшла за посиланням друга.
-- 'ok' | 'not_found' | 'self' | 'already' (уже привʼязаний) | 'not_new' (уже замовляв раніше) | 'unauthorized'
create or replace function public.customer_set_referrer(code text)
returns text language plpgsql security definer set search_path = public as $$
declare ref_id uuid; me public.customers%rowtype;
begin
  if auth.uid() is null then return 'unauthorized'; end if;
  select * into me from public.customers where id = auth.uid();
  if not found then return 'unauthorized'; end if;
  if me.referred_by is not null then return 'already'; end if;
  select id into ref_id from public.customers where upper(ref_code) = upper(trim(code));
  if ref_id is null then return 'not_found'; end if;
  if ref_id = me.id or exists (select 1 from public.customers r where r.id = ref_id and r.phone_norm is not null and r.phone_norm = me.phone_norm) then
    return 'self';
  end if;
  if exists (select 1 from public.orders o where o.status <> 'canceled'
             and (o.user_id = me.id or (me.phone_norm is not null and o.phone_norm = me.phone_norm))) then
    return 'not_new';
  end if;
  update public.customers set referred_by = ref_id, referred_at = now() where id = me.id and referred_by is null;
  return 'ok';
end; $$;
revoke all on function public.customer_set_referrer(text) from public;
grant execute on function public.customer_set_referrer(text) to authenticated;

-- ---------- Запрошені для кабінету ----------
-- Хто: зареєстровані за посиланням (referred_by) + гості, що замовили з кодом (orders.referrer_id).
-- status: 'registered' — зареєструвався, ще не замовляв; 'ordered' — зробив замовлення;
--         'confirmed' — замовлення за кодом підтверджено/виконано (сертифікат видано).
-- name — лише імʼя (перше слово), без контактів.
drop function if exists public.my_referrals();
create function public.my_referrals()
returns table (name text, status text, since timestamptz)
language sql stable security definer set search_path = public as $$
  with friends as (
    select c.id as cid, c.name, c.phone_norm, c.referred_at as since
    from public.customers c where c.referred_by = auth.uid()
    union all
    select null, o.customer_name, o.phone_norm, min(o.created_at)
    from public.orders o
    where o.referrer_id = auth.uid()
      and not exists (select 1 from public.customers c where c.referred_by = auth.uid()
                      and (c.id = o.user_id or (c.phone_norm is not null and c.phone_norm = o.phone_norm)))
    group by o.customer_name, o.phone_norm
  )
  select split_part(trim(coalesce(f.name, '')), ' ', 1),
         case
           when exists (select 1 from public.orders o where o.referrer_id = auth.uid() and o.referral_points_at is not null
                        and (o.user_id = f.cid or (f.phone_norm is not null and o.phone_norm = f.phone_norm))) then 'confirmed'
           when exists (select 1 from public.orders o where o.status <> 'canceled'
                        and (o.user_id = f.cid or (f.phone_norm is not null and o.phone_norm = f.phone_norm))) then 'ordered'
           else 'registered'
         end,
         f.since
  from friends f
  where auth.uid() is not null
  order by f.since desc nulls last;
$$;
revoke all on function public.my_referrals() from public;
grant execute on function public.my_referrals() to authenticated;

comment on column public.orders.referral_points_at is 'Коли видано нагороду запрошувачу (сертифікат) за це замовлення.';

notify pgrst, 'reload schema';
