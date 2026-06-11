-- =============================================================================
--  КБЖУ інгредієнтів (на 100 г). Орієнтовні значення, редагуються в адмінці.
-- =============================================================================

alter table public.ingredients
  add column kcal    numeric(7,2),
  add column protein numeric(6,2),
  add column fat     numeric(6,2),
  add column carbs   numeric(6,2);
