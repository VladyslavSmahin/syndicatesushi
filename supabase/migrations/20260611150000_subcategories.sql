-- =============================================================================
--  Підкатегорії — рівень нижче категорії (напр. типи ролів усередині «роли»).
--  Додає таблицю public.subcategories та звʼязок products.subcategory_id.
-- =============================================================================

create table public.subcategories (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name        text not null,
  slug        text not null,
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  -- slug унікальний у межах категорії (різні категорії можуть мати однакові slug)
  unique (category_id, slug)
);

create index on public.subcategories (category_id);

-- звʼязок товару з підкатегорією (опційний)
alter table public.products
  add column subcategory_id uuid references public.subcategories(id) on delete set null;

create index on public.products (subcategory_id);

-- =====================================================================
--  RLS: читати — публічно; insert/update — staff; delete — admin
--  (той самий шаблон, що й для categories/products)
-- =====================================================================
alter table public.subcategories enable row level security;

create policy subcategories_read   on public.subcategories for select using (true);
create policy subcategories_insert on public.subcategories for insert with check (public.is_staff());
create policy subcategories_update on public.subcategories for update using (public.is_staff()) with check (public.is_staff());
create policy subcategories_delete on public.subcategories for delete using (public.is_admin());

-- =====================================================================
--  Сід підкатегорій ролів (категорія slug = 'роли')
-- =====================================================================
insert into public.subcategories (category_id, name, slug, sort_order)
select c.id, v.name, v.slug, v.sort_order
from public.categories c
join (values
  ('Elite роли',     'elite',        10),
  ('Філадельфії',    'philadelphia', 20),
  ('Дракони',        'drakony',      30),
  ('Темпури',        'tempury',      40),
  ('Каліфорнії',     'californii',   50),
  ('Вулкани',        'vulkany',      60),
  ('Футомаки',       'futomaki',     70),
  ('Макі',           'maki',         80),
  ('Хенд роли',      'hand',         90),
  ('Гункани / Суші', 'gunkany',      100)
) as v(name, slug, sort_order) on true
where c.slug = 'роли'
on conflict (category_id, slug) do nothing;
