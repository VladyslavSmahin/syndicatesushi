-- =====================================================================
--  1) Білий список ↔ profiles: зміни в allowed_staff діють одразу
--     Раніше profiles заповнювався лише при створенні auth-користувача, тож
--     видалення зі списку / зміна ролі не забирали доступ.
-- =====================================================================

create or replace function public.sync_staff_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- видалили або змінили email — профіль старої адреси прибираємо
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and lower(old.email) <> lower(new.email)) then
    delete from public.profiles where lower(email) = lower(old.email);
  end if;

  -- додали / змінили роль — якщо користувач уже входив, одразу видаємо (оновлюємо) роль
  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.profiles (id, email, role)
    select u.id, u.email, new.role from auth.users u where lower(u.email) = lower(new.email)
    on conflict (id) do update set role = excluded.role, email = excluded.email;
  end if;

  return null;
end; $$;

drop trigger if exists allowed_staff_sync on public.allowed_staff;
create trigger allowed_staff_sync
  after insert or update or delete on public.allowed_staff
  for each row execute function public.sync_staff_profile();

-- роль для RLS — лише якщо email досі у білому списку (підстраховка на випадок розсинхрону)
create or replace function public.user_role()
returns text language sql stable security definer set search_path = public as $$
  select s.role
  from public.profiles p
  join public.allowed_staff s on lower(s.email) = lower(p.email)
  where p.id = auth.uid();
$$;

-- разове вирівнювання: профілі без запису в білому списку — видаляємо, ролі — з білого списку
delete from public.profiles p
where not exists (select 1 from public.allowed_staff s where lower(s.email) = lower(p.email));

update public.profiles p set role = s.role
from public.allowed_staff s
where lower(s.email) = lower(p.email) and p.role <> s.role;

-- =====================================================================
--  2) Контакти авторів відгуків — не публічні
--     RLS фільтрує рядки, а не колонки: анонім міг прочитати contact схвалених відгуків.
--     Колонку закриваємо для anon/authenticated, адмінка бере контакти через функцію (лише staff).
-- =====================================================================

revoke select on public.reviews from anon, authenticated;
grant select (id, author_name, rating, text, status, created_at) on public.reviews to anon, authenticated;

create or replace function public.staff_review_contacts()
returns table (id uuid, contact text)
language sql stable security definer set search_path = public as $$
  select r.id, r.contact from public.reviews r where public.is_staff();
$$;

revoke all on function public.staff_review_contacts() from public;
grant execute on function public.staff_review_contacts() to authenticated;

-- =====================================================================
--  3) Промокоди: лічильник використань (usage_limit не працював — used_count не зростав)
-- =====================================================================

create or replace function public.count_promo_usage()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.promo_code_id is not null then
    update public.promo_codes set used_count = used_count + 1 where id = new.promo_code_id;
  end if;
  return null;
end; $$;

drop trigger if exists orders_count_promo on public.orders;
create trigger orders_count_promo
  after insert on public.orders
  for each row execute function public.count_promo_usage();
