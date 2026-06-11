-- =============================================================================
--  Самодостатній сід каталогу в БД (для `supabase db push` на прод).
--  seed.sql на проді не виконується, тому базові довідники (категорії, інгредієнти,
--  підкатегорії) сіємо тут повторно — ідемпотентно (on conflict do nothing).
--  Порядок: категорії → інгредієнти(КБЖУ) → підкатегорії → товари → звʼязки.
--  Грамовка інгредієнтів поки null (заповнюється в адмінці).
-- =============================================================================

-- ---- 1. Категорії ----
insert into public.categories (name, slug, sort_order, show_in_nav, is_active) values
  ('Сети',       'сети',   10, true, true),
  ('Роли',       'роли',   20, true, true),
  ('Вок',        'вок',    30, true, true),
  ('Соуси',      'соуси',  40, true, true),
  ('Супи',       'супи',   50, true, true),
  ('Суш-буріто', 'буріто', 60, true, true)
on conflict (slug) do nothing;

-- ---- 2. Інгредієнти + КБЖУ на 100 г ----
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
  ('Рис',          'rys',         130, 2.4, 0.3, 28),
  ('Рис чорний',   'rys-black',   140, 3.5, 1,   30),
  ('Норі',         'nori',         35, 5.8, 0.3, 5),
  ('Рисовий папір','rice-paper',  330, 1,   0,   82),
  ('Кляр',         'klyar',       300, 6,   15,  35),
  ('Рисові кульки','rice-balls',  380, 6,   12,  62)
on conflict (slug) do nothing;

-- ---- 3. Підкатегорії ролів ----
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

-- ---- 4. Товари ----
insert into public.products
  (category_id, subcategory_id, name, slug, short_desc, full_desc, composition, price, weight, pieces, badge, is_available, sort_order)
select c.id, sc.id, v.name, v.slug, v.short_desc, v.full_desc, v.composition,
       v.price, nullif(v.weight, ''), v.pieces, nullif(v.badge, ''), true, v.sort_order
from (values
  -- (slug, cat_slug, sub_slug, name, short_desc, full_desc, composition, price, weight, pieces, badge, sort_order)
  ('philadelphia-elite-shrimp','роли','elite','Філадельфія Elite з креветкою','Креветка, лосось, груша, унагі','Преміальний рол з тигровою креветкою, ніжним лососем, соковитою грушею та ікрою масаго.','Рис, норі, сир, креветка, груша, лосось, унагі, масаго',400,'','8 шт','',10),
  ('imperator','роли','elite','Імператор','Креветка, краб, лосось, полуниця','Розкішний рол з креветкою, крабом та лососем, доповнений сублімованою полуницею та ікрою масаго.','Рис, норі, сир, масаго, креветка, краб, лосось, унагі, сублімована полуниця',400,'','8 шт','',20),
  ('black-pearl','роли','elite','Чорна Перлина','Вугор, лосось, чеддер, чорний рис','Ефектний рол на чорному рисі з вугрем, лососем та сиром чеддер, прикрашений кандурином.','Рис чорний, норі, сир, вугор, авокадо, масаго, чеддер, лосось, унагі, кандурин',400,'','8 шт','',30),
  ('philadelphia-big','роли','elite','Філадельфія BIG','Лосось, сир, огірок','Збільшена порція класичної Філадельфії з лососем, вершковим сиром та свіжим огірком.','Рис, норі, сир, огірок, лосось',400,'','8 шт','',40),
  ('phoenix','роли','elite','Фенікс','Лосось, креветка, краб, манго','Яскравий рол на чорному рисі з лососем, креветкою, крабом, авокадо та солодким манго.','Рис чорний, норі, сир, лосось, креветка, краб, чеддер, авокадо, унагі, манго, масаго',400,'','8 шт','',50),
  ('tempura-black','роли','elite','Темпура Black','Вугор, чеддер, авокадо в чорному клярі','Запечений рол у чорному клярі з вугрем, сиром чеддер та авокадо. Подається теплим.','Рис чорний, норі, сир, вугор, масаго, чеддер, авокадо, унагі, чорний кляр, рисові кульки',400,'','8 шт','',60),
  ('author-spring-roll','роли','elite','Авторський Спрінг рол','Лосось, креветка, краб, манго, полуниця','Авторський рол у рисовому папері з лососем, креветкою, крабом та фруктовим акцентом манго й полуниці.','Рис, рисовий папір, сир, лосось, креветка, краб, манго, полуниця, масаго',400,'','8 шт','',70),
  ('gold-lotus','роли','elite','GOLD LOTUS','Краб, креветка, чеддер, авокадо','Преміальний рол на чорному рисі з крабом, креветкою, сиром чеддер та авокадо, оздоблений кандурином.','Рис чорний, норі, сир, краб, пекінська капуста, чеддер, авокадо, боули з креветки, унагі, масаго, кандурин',400,'','8 шт','',80),
  ('philadelphia-salmon','роли','philadelphia','Філадельфія з лососем','Лосось, сир, огірок, авокадо','Класична Філадельфія зі слабосоленим лососем, вершковим сиром, огірком та авокадо.','Рис, норі, сир, огірок, авокадо, лосось',400,'','8 шт','',90),
  ('philadelphia-eel','роли','philadelphia','Філадельфія з вугрем','Вугор, сир, огірок, авокадо','Філадельфія з копченим вугрем, вершковим сиром, огірком та авокадо під соусом унагі.','Рис, норі, сир, огірок, авокадо, масаго, вугор, унагі',400,'','8 шт','',100),
  ('philadelphia-shrimp','роли','philadelphia','Філадельфія з креветкою','Креветка, сир, авокадо','Філадельфія з тигровою креветкою, вершковим сиром та авокадо під японським майонезом.','Рис, норі, сир, масаго, авокадо, креветка, унагі, японський майонез',400,'','8 шт','',110),
  ('philadelphia-grill-pear','роли','philadelphia','Філадельфія гриль з грушею','Лосось гриль, груша, сир','Тепла Філадельфія з лососем на грилі, соковитою грушею та карамелізованим цукром і горіхами.','Рис, норі, сир, масаго, груша, лосось гриль, карамелізований цукор, горіхи',400,'','8 шт','',120),
  ('philadelphia-tuna','роли','philadelphia','Філадельфія з тунцем','Тунець, сир, огірок, авокадо','Філадельфія з ніжним тунцем, вершковим сиром, огірком та авокадо під соусом унагі.','Рис, норі, сир, огірок, авокадо, тунець, унагі',400,'','8 шт','',130),
  ('philadelphia-smoked-salmon','роли','philadelphia','Філадельфія копчений лосось','Копчений лосось, сир, огірок, авокадо','Філадельфія з копченим лососем, вершковим сиром, огірком та авокадо під соусом унагі.','Рис, норі, сир, огірок, авокадо, копчений лосось, унагі',400,'','8 шт','',140),
  -- сети / суп (демо — за потреби приберете в адмінці)
  ('set-imperia','сети',null,'Сет Імперія','32 ролі, мікс смаків','Великий сет з 32 ролів — ідеальний для компанії або вечірки. Мікс найкращих смаків.','Філадельфія, Каліфорнія, Дракон, Темпура — по 8 шт кожного',699,'1200 г','32 шт','ХІТ',150),
  ('set-philadelphia-duo','сети',null,'Сет Філадельфія для двох','24 ролі філадельфія','Романтичний сет з 24 ролів Філадельфія — ідеальний для побачення.','Філадельфія класик, Філадельфія з лососем, Філадельфія з авокадо — по 8 шт',599,'900 г','24 шт','',160),
  ('miso-soup','супи',null,'Місо суп','Тофу, водорості, цибуля','Традиційний японський суп з тофу, водоростями вакаме та зеленою цибулею.','Паста місо, тофу, водорості вакаме, зелена цибуля, бульйон даші',89,'300 мл','1 порція','',170)
) as v(slug, cat_slug, sub_slug, name, short_desc, full_desc, composition, price, weight, pieces, badge, sort_order)
join public.categories c on c.slug = v.cat_slug
left join public.subcategories sc on sc.slug = v.sub_slug and sc.category_id = c.id
on conflict (slug) do nothing;

-- ---- 5. Звʼязки товар ↔ інгредієнт (для фільтра; grams = null поки не задано) ----
insert into public.product_ingredients (product_id, ingredient_id)
select p.id, i.id
from (values
  ('philadelphia-elite-shrimp','rys'),('philadelphia-elite-shrimp','nori'),('philadelphia-elite-shrimp','syr'),('philadelphia-elite-shrimp','krevetka'),('philadelphia-elite-shrimp','grusha'),('philadelphia-elite-shrimp','losos'),('philadelphia-elite-shrimp','unagi'),('philadelphia-elite-shrimp','masago'),
  ('imperator','rys'),('imperator','nori'),('imperator','syr'),('imperator','masago'),('imperator','krevetka'),('imperator','krab'),('imperator','losos'),('imperator','unagi'),('imperator','polunytsia'),
  ('black-pearl','rys-black'),('black-pearl','nori'),('black-pearl','syr'),('black-pearl','ugor'),('black-pearl','avokado'),('black-pearl','masago'),('black-pearl','cheddar'),('black-pearl','losos'),('black-pearl','unagi'),('black-pearl','kanduryn'),
  ('philadelphia-big','rys'),('philadelphia-big','nori'),('philadelphia-big','syr'),('philadelphia-big','ogirok'),('philadelphia-big','losos'),
  ('phoenix','rys-black'),('phoenix','nori'),('phoenix','syr'),('phoenix','losos'),('phoenix','krevetka'),('phoenix','krab'),('phoenix','cheddar'),('phoenix','avokado'),('phoenix','unagi'),('phoenix','mango'),('phoenix','masago'),
  ('tempura-black','rys-black'),('tempura-black','nori'),('tempura-black','syr'),('tempura-black','ugor'),('tempura-black','masago'),('tempura-black','cheddar'),('tempura-black','avokado'),('tempura-black','unagi'),('tempura-black','klyar'),('tempura-black','rice-balls'),
  ('author-spring-roll','rys'),('author-spring-roll','rice-paper'),('author-spring-roll','syr'),('author-spring-roll','losos'),('author-spring-roll','krevetka'),('author-spring-roll','krab'),('author-spring-roll','mango'),('author-spring-roll','polunytsia'),('author-spring-roll','masago'),
  ('gold-lotus','rys-black'),('gold-lotus','nori'),('gold-lotus','syr'),('gold-lotus','krab'),('gold-lotus','pekin-cabbage'),('gold-lotus','cheddar'),('gold-lotus','avokado'),('gold-lotus','krevetka'),('gold-lotus','unagi'),('gold-lotus','masago'),('gold-lotus','kanduryn'),
  ('philadelphia-salmon','rys'),('philadelphia-salmon','nori'),('philadelphia-salmon','syr'),('philadelphia-salmon','ogirok'),('philadelphia-salmon','avokado'),('philadelphia-salmon','losos'),
  ('philadelphia-eel','rys'),('philadelphia-eel','nori'),('philadelphia-eel','syr'),('philadelphia-eel','ogirok'),('philadelphia-eel','avokado'),('philadelphia-eel','masago'),('philadelphia-eel','ugor'),('philadelphia-eel','unagi'),
  ('philadelphia-shrimp','rys'),('philadelphia-shrimp','nori'),('philadelphia-shrimp','syr'),('philadelphia-shrimp','masago'),('philadelphia-shrimp','avokado'),('philadelphia-shrimp','krevetka'),('philadelphia-shrimp','unagi'),('philadelphia-shrimp','jp-mayo'),
  ('philadelphia-grill-pear','rys'),('philadelphia-grill-pear','nori'),('philadelphia-grill-pear','syr'),('philadelphia-grill-pear','masago'),('philadelphia-grill-pear','grusha'),('philadelphia-grill-pear','losos'),('philadelphia-grill-pear','gryl'),('philadelphia-grill-pear','caramel-sugar'),('philadelphia-grill-pear','horihy'),
  ('philadelphia-tuna','rys'),('philadelphia-tuna','nori'),('philadelphia-tuna','syr'),('philadelphia-tuna','ogirok'),('philadelphia-tuna','avokado'),('philadelphia-tuna','tunets'),('philadelphia-tuna','unagi'),
  ('philadelphia-smoked-salmon','rys'),('philadelphia-smoked-salmon','nori'),('philadelphia-smoked-salmon','syr'),('philadelphia-smoked-salmon','ogirok'),('philadelphia-smoked-salmon','avokado'),('philadelphia-smoked-salmon','losos'),('philadelphia-smoked-salmon','unagi'),
  ('set-imperia','losos'),('set-imperia','krab'),('set-imperia','syr'),('set-imperia','avokado'),
  ('set-philadelphia-duo','losos'),('set-philadelphia-duo','syr'),('set-philadelphia-duo','avokado')
) as v(product_slug, ing_slug)
join public.products p on p.slug = v.product_slug
join public.ingredients i on i.slug = v.ing_slug
on conflict do nothing;
