-- =============================================================================
--  Seed — стартові дані. Виконується при `supabase db reset`.
--  Каталог товарів зручніше наповнювати через адмінку; тут — базовий мінімум.
-- =============================================================================

-- ⚠️ БУТСТРАП АДМІНА: впишіть свій Google-email, щоб отримати доступ при першому вході.
insert into public.allowed_staff (email, role) values
  ('owner@example.com', 'admin')   -- ← ЗАМІНІТЬ на свій email
on conflict (email) do nothing;

-- Категорії
insert into public.categories (name, slug, sort_order, show_in_nav, is_active) values
  ('Сети',       'сети',   10, true, true),
  ('Роли',       'роли',   20, true, true),
  ('Вок',        'вок',    30, true, true),
  ('Соуси',      'соуси',  40, true, true),
  ('Супи',       'супи',   50, true, true),
  ('Суш-буріто', 'буріто', 60, true, true)
on conflict (slug) do nothing;

-- Інгредієнти (окрема сутність — для фільтра)
insert into public.ingredients (name, slug) values
  ('Лосось',  'losos'),
  ('Тунець',  'tunets'),
  ('Угор',    'ugor'),
  ('Авокадо', 'avokado'),
  ('Сир',     'syr'),
  ('Креветка','krevetka'),
  ('Огірок',  'ogirok'),
  ('Гриль',   'gryl'),
  ('Краб',    'krab')
on conflict (slug) do nothing;

-- Налаштування магазину
insert into public.settings (key, value) values
  ('min_order',         '0'),       -- мінімальної суми немає
  ('delivery_cost',     '0'),       -- уточнимо пізніше
  ('free_delivery_from','null')
on conflict (key) do nothing;

-- Приклади промокодів
insert into public.promo_codes (code, discount_type, discount_value, is_active) values
  ('SUSHI10',   'percent', 10, true),
  ('WELCOME50', 'fixed',   50, true)
on conflict (code) do nothing;
