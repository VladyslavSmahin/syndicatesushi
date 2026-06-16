-- Безпека: прибираємо ПУБЛІЧНИЙ insert відгуків.
-- Раніше будь-хто з anon-ключем міг лити відгуки напряму (status='pending'),
-- минаючи rate-limit і ліміти серверного роуту. Тепер відгуки приймаються ВИКЛЮЧНО
-- через /api/review (service_role, обходить RLS). Прямий insert — лише staff.
drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews for insert with check (public.is_staff());
