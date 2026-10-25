-- 1) «Показувати в меню»: роли, що йдуть лише в склад сетів, на сайті не показуються,
--    але залишаються доступними для set_items (склад і КБЖУ сета).
alter table public.products add column if not exists show_in_menu boolean not null default true;

-- 2) Щоденне вікно акції (київський час): напр. daily_until = 16:00 — до 16:00 акційна ціна, після — звичайна.
--    null — без обмеження з цього боку (акція діє весь день у межах valid_from…valid_until).
alter table public.promos add column if not exists daily_from  time;
alter table public.promos add column if not exists daily_until time;

-- 3) Палички тепер безкоштовні й обираються в кошику окремим кроком — платну позицію з «Додатково» знімаємо
--    (is_available = false: повернути можна в адмінці, «В наявності»).
update public.products p
   set is_available = false
  from public.categories c
 where c.id = p.category_id and c.slug = 'додатково' and p.name = 'Палички' and p.deleted_at is null;
