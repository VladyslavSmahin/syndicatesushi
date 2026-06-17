-- Банери головної сторінки (Hero-слайдер).
-- Проста модель: клієнт сам малює готовий банер і завантажує картинку в адмінці
-- (розділ «Акції» → вкладка «Баннери»). Сервер конвертує її у WebP і кладе в
-- Cloudflare R2; у БД зберігається лише публічний URL (image_path).
create table if not exists public.banners (
  id          uuid primary key default gen_random_uuid(),
  image_path  text not null,
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists banners_sort_idx on public.banners (sort_order);

alter table public.banners enable row level security;

-- читання: публічно лише активні (як promos); staff бачить усі
create policy banners_read   on public.banners for select using (is_active or public.is_staff());
create policy banners_insert on public.banners for insert with check (public.is_staff());
create policy banners_update on public.banners for update using (public.is_staff()) with check (public.is_staff());
create policy banners_delete on public.banners for delete using (public.is_staff());
