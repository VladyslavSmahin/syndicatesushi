-- Чекбокс на оформленні «Не телефонуйте мені для підтвердження замовлення» (06.11.2026).
-- Менеджер бачить позначку в Telegram-сповіщенні та на дошці замовлень. Старі замовлення — false.
alter table public.orders
  add column if not exists no_call boolean not null default false;
