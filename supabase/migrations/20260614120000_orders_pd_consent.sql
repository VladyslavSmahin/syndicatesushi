-- Фіксація факту згоди на обробку персональних даних при оформленні замовлення.
-- Nullable: старі замовлення лишаються без значення.
alter table public.orders
  add column if not exists pd_consent_at timestamptz;

comment on column public.orders.pd_consent_at is
  'Момент надання згоди на обробку персональних даних (галочка в кошику).';
