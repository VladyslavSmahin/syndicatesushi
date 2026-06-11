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

-- Інгредієнти (окрема сутність — для фільтра). КБЖУ на 100 г (орієнтовно).
insert into public.ingredients (name, slug, kcal, protein, fat, carbs) values
  ('Лосось',  'losos',    208, 20,   13,   0),
  ('Тунець',  'tunets',   130, 23,   4,    0),
  ('Угор',    'ugor',     236, 19,   18,   0),
  ('Креветка','krevetka',  99, 24,   0.3,  0.2),
  ('Краб',    'krab',      90, 18,   1,    0),
  ('Авокадо', 'avokado',  160, 2,    15,   9),
  ('Сир',     'syr',      342, 6,    34,   4),
  ('Огірок',  'ogirok',    15, 0.7,  0.1,  3.6),
  ('Гриль',   'gryl',     null, null, null, null),
  -- інгредієнти преміум / філадельфій
  ('Масаго',               'masago',         60, 12,  3,   3),
  ('Чеддер',               'cheddar',       402, 25,  33,  1.3),
  ('Груша',                'grusha',         57, 0.4, 0.1, 15),
  ('Манго',                'mango',          60, 0.8, 0.4, 15),
  ('Полуниця',             'polunytsia',     33, 0.7, 0.3, 8),
  ('Унагі',                'unagi',         130, 3,   0.5, 28),
  ('Кандурин',             'kanduryn',     null, null, null, null),
  ('Японський майонез',    'jp-mayo',       680, 1,   75,  2),
  ('Карамелізований цукор','caramel-sugar', 390, 0,   0,   98),
  ('Горіхи',               'horihy',        654, 15,  65,  14),
  ('Пекінська капуста',    'pekin-cabbage',  16, 1.2, 0.2, 3.2),
  -- основа
  ('Рис',          'rys',         130, 2.4, 0.3, 28),
  ('Рис чорний',   'rys-black',   140, 3.5, 1,   30),
  ('Норі',         'nori',         35, 5.8, 0.3, 5),
  ('Рисовий папір','rice-paper',  330, 1,   0,   82),
  ('Кляр',         'klyar',       300, 6,   15,  35),
  ('Рисові кульки','rice-balls',  380, 6,   12,  62)
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
