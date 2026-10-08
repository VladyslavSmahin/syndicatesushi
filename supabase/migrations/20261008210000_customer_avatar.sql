-- Фото профілю клієнта (кабінет → кільце заповненості профілю).
-- Пише лише сервер (/api/avatar, service role) після перевірки сесії: клієнт не може підставити довільний URL —
-- тому grant update на цю колонку клієнтам НЕ даємо (див. 20261008120000: лише name, phone).
alter table public.customers add column if not exists avatar_url text;
