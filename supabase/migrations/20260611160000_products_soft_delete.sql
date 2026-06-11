-- =============================================================================
--  Мʼяке видалення товарів (кошик на 90 днів).
--  Додає products.deleted_at; публічне читання приховує видалені товари.
--  Фізичне прибирання прострочених (понад 90 днів) — окремий scheduled job
--  (pg_cron / Edge Function), напр.:
--    delete from public.products
--    where deleted_at is not null and deleted_at < now() - interval '90 days';
-- =============================================================================

alter table public.products
  add column deleted_at timestamptz;

-- частковий індекс: швидко відбирати активні / вміст кошика
create index products_active_idx  on public.products (id) where deleted_at is null;
create index products_deleted_idx on public.products (deleted_at) where deleted_at is not null;

-- Публічне читання має приховувати видалені; staff бачить усе (для кошика).
drop policy if exists products_read on public.products;
create policy products_read on public.products
  for select using (deleted_at is null or public.is_staff());
