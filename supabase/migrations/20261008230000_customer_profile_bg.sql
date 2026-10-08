-- Фон особистого кабінету: тема або своє фото + кадр для телефона/компʼютера (див. src/lib/profileBg.ts).
-- Пише лише сервер (/api/profile-bg, service role) після перевірки сесії й валідації src — grant клієнтам не даємо.
alter table public.customers add column if not exists profile_bg jsonb;
notify pgrst, 'reload schema';
