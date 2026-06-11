# Sushi Syndicate — статус и роадмап

Живой рабочий журнал проекта. Подробности архитектуры — в `ARCHITECTURE.md`.

## ✅ Сделано
- **Фронтенд** (Next.js 15, App Router, TS): витрина, корзина (Context+localStorage), чекаут, адаптив, Hero-слайдер акций, мобильный UX.
- **Реальная Google-аутентификация** (Supabase Auth):
  - `/admin/login` → OAuth, `/auth/callback`, `middleware` гардит `/admin`.
  - Роль из таблицы `profiles` (заполняется триггером из `allowed_staff`); экран «Немає доступу» для не-белого списка.
  - Белый список сотрудников — CRUD в БД (`/admin/staff`).
- **Весь каталог на Supabase** (хардкод убран):
  - Публичный сайт читает из БД через SSR (`page.tsx` → `publicData.server` → `PublicDataProvider`), `force-dynamic`.
  - Админ-слой данных `src/features/admin/db.ts` (хуки `useDb*` + мутации) — товары, категории, **подкатегории** (новая сущность + страница), ингредиенты (КБЖУ), акции, промокоды, история цен.
  - **Soft-delete товаров** (корзина 90 дней, авто-очистка).
  - **Граммовка ингредиентов** → авто-расчёт веса и КБЖУ порции (форма товара + карточка на сайте).
  - **Bulk-цены** по ингредиенту и **история цен** с откатом (`price_history` в БД).
- **Заказы и отзывы пишутся в БД** (`orders`/`order_items`/`reviews`) + Telegram.
  - Заказ: цены и скидка по промокоду **пересчитываются на сервере из БД** (защита от подмены цен на клиенте).
- **Схема БД** (миграции в `supabase/migrations/`): init + subcategories, products.subcategory_id, soft-delete, КБЖУ, граммовка, price_history, сид каталога.
- **Деплой**: прод `syndicatesushi.vercel.app` (deploy вручную — git-автодеплоя нет).

## 🔐 Security-чек-ап (2026-06-11)
- ✅ **Исправлено**: подмена цен в заказе — `/api/order` пересчитывает цены/скидку из БД (раньше доверял клиенту).
- ✅ RLS на всех таблицах: публичное чтение каталога, запись — `is_staff()`, удаление — `is_admin()`. `promo_codes`/`price_history`/`orders` — только staff. Service-role ключ только на сервере (`server-only`).
- ✅ Без `dangerouslySetInnerHTML`; Telegram-сообщения экранируются (`esc`).
- ⚠️ **Нет rate-limit** на `/api/order` и `/api/review` — возможен спам. Добавить (напр. по IP/Upstash) позже.
- ⚠️ `npm audit`: 2 moderate — транзитивный `postcss` через Next (build-time, у нас не эксплуатируется). Обновить Next, когда удобно; **не** `audit fix --force` (ломает).
- ℹ️ Отзывы можно отправить и напрямую анон-клиентом (RLS `insert` со статусом `pending`) → всё равно попадают в модерацию.

## ⏭️ Роадмап (следующее)
1. **Админ-просмотр заказов** (`/admin/orders` — сейчас заглушка): список, статусы `new/confirmed/done/canceled`, фильтры.
2. **Модерация отзывов** (`/admin/reviews` — заглушка): `pending/approved/rejected`; публичный блок отзывов читает `approved`.
3. **Фото товаров → Supabase Storage** (сейчас data URL в `image_path` — тяжело для payload, грузит SSR).
4. **Доставка по адресу**: автоподсказки (OSM/Photon) + расстояние (Haversine ×1.3) + цена (100 грн до 2 км, далее +20 грн/5 км) в `settings`; пересчёт на сервере (заказ уже серверный).
5. **Контакты/тексты в `settings`** (сейчас статикой в `src/data/site.ts`).
6. **Курация фильтр-чипов** (сейчас все ингредиенты из каталога, включая рис/норі) — флаг `is_filter` или ручной список.
7. **Производительность**: публичная `/` `force-dynamic` (4 запроса на каждый запрос) — рассмотреть `revalidate`/кэш с инвалидацией при изменениях.
8. **Git-автодеплой Vercel**: связать репозиторий (Settings → Git, Production Branch = main), чтобы push деплоил.

## 🔑 Переменные окружения
Локально (`.env.local`, gitignored): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_URL_SP` (session pooler).
В Vercel (Production) обязательны: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (заказы/отзывы), `TELEGRAM_*`.

## ⚠️ Не забыть
- **Не запускать `supabase db push`**: схему применяли напрямую (SQL), таблица миграций рассинхронизирована — упадёт без `migration repair`. Изменения БД делать напрямую/через SQL Editor.
- Прямое подключение `db.<ref>.supabase.co` не резолвится локально (IPv6) — использовать **session pooler** (`aws-1-eu-central-1.pooler.supabase.com`), пароль из `SUPABASE_DB_PASSWORD` (в URL он URL-энкодирован).
- Бот-токен в `.env.local` мог быть засвечен — заменить через `/revoke` @BotFather.
- `client_secret_*.json` в корне — секрет, gitignored; приложению не нужен, можно удалить.
