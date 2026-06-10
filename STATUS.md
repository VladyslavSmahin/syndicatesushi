# Sushi Syndicate — статус и бэклог

Живой рабочий журнал проекта. Подробности архитектуры — в `ARCHITECTURE.md`.

## ✅ Сделано
- **Фронтенд** (Next.js 15, App Router, TS): витрина с прототипа, корзина (Context+localStorage), чекаут-форма, адаптив.
- **Hero** — вертикальный 3D-coverflow слайдер акций (авто 5с, пауза ≥3с после ручного, индикаторы сбоку).
- **Мобильный UX**: бургер-меню (drawer слева 90%), фиксированная нижняя панель категорий, FAB-фильтр с нижним листом, «Завантажити більше», компактные карточки хитов.
- **Фильтр по ингредиентам** — мультивыбор (товар содержит все выбранные), закрытие листа кликом вне.
- **Переключение категории** меняет заголовок и список «Повне меню».
- **Google-карта** в блоке расположения (вул. Незалежності, 7) — OSM/iframe, без ключа.
- **Telegram** — `/api/order` и `/api/review` шлют в группу (локально работает; на проде нужен Redeploy после env).
- **Каркас админки** `/admin` (демо-вход Google, роли admin/editor, демо-переключатель роли):
  - Категории (CRUD, видны в шапке/бургере), Товары (CRUD + фото + ингредиенты-сущности), Ингредиенты, Акции, Промокоды, Сотрудники (белый список), Заглушки заказов/отзывов.
  - **Bulk-цены** по ингредиенту (превью old→new, ±/удалить из партии).
  - **История цен** с откатом (одиночные + массовые) — `/admin/price-history`.
- **Favicon** — `src/app/icon.svg` (ролл-маки).
- **Supabase**:
  - Проект ref: `khwvbfkhrzufibkpuvtu`, URL `https://khwvbfkhrzufibkpuvtu.supabase.co`.
  - Схема применена (миграция `supabase/migrations/20260610120000_init.sql`): все таблицы + RLS + роли + триггеры.
  - Seed: 6 категорий, 9 ингредиентов, 3 settings, 2 промокода, 1 admin-заглушка.
  - **Засеяно 12 товаров + 30 связей** `product_ingredients`.
  - Клиенты созданы: `src/lib/supabase/{client,server,admin}.ts`.

## 🔌 Текущий разрыв (важно)
- Публичный сайт читает **статику** (`src/data/site.ts`).
- Админка пишет в **localStorage** (демо-сторы).
- БД наполнена, но **пока никто не читает/не пишет** Supabase из приложения.

## ⏭️ Следующий крупный шаг — миграция домена товаров на БД (единый источник правды)
1. Публичный каталог (категории/товары/ингредиенты/фильтр) — чтение из Supabase (server fetch + context). id товаров → uuid.
2. Админка (CRUD товаров/категорий/ингредиентов/акций/промокодов, bulk, история) — запись в Supabase через серверные actions.
3. История цен → таблица `price_history` (сейчас localStorage).
4. Заказы/отзывы — запись в БД + Telegram.

## 📋 Бэклог
- **Доставка по адресу**: автоподсказки (OSM/Photon) + расстояние (Haversine ×1.3) + цена **100 грн до 2 км, далее +20 грн/5 км** (настраивается в `settings`). Пересчёт на сервере.
- **Cloudflare R2** для картинок (free 10 ГБ) + оптимизация на загрузке (`sharp` → WebP, ресайз). Account ID: `2533bf012ffae4a78bd7edc83450c85e`. Нужны R2-ключи.
- **Google OAuth** для входа в админку (нужны Google client id/secret) + email админа в `allowed_staff`.
- **Telegram на проде**: добавить env в Vercel (Production) + **Redeploy**.
- Деплой: репозиторий `github.com/VladyslavSmahin/syndicatesushi`, прод `syndicatesushi.vercel.app`.

## 🔑 Переменные окружения
Локально (`.env.local`, gitignored): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_URL_SP` (session pooler).
В Vercel (Production) нужно добавить те же + R2-ключи, затем Redeploy.

## ⚠️ Не забыть
- Бот-токен в `.env.local` — временный (засвечен в чате), заменить после `/revoke` в @BotFather.
- Прямое подключение к БД (`db.<ref>.supabase.co`) не резолвится с этой машины (IPv6) — использовать **Session pooler** (`aws-1-eu-central-1.pooler.supabase.com`).
