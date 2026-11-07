-- Програма лояльності в адмінці (/admin/loyalty): коментарі адміністраторів до пунктів концепції.
-- Пункти (текст концепції) живуть у коді й віддаються лише адміну з сервера; тут — тільки коментарі.
-- Доступ — лише admin: у концепції фінанси бізнесу (прибуток, собівартість).

create table if not exists public.loyalty_comments (
  id uuid primary key default gen_random_uuid(),
  item_key text not null check (char_length(item_key) between 1 and 80),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  author_id uuid references auth.users (id) on delete set null,
  author_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loyalty_comments_item_idx on public.loyalty_comments (item_key, created_at);

alter table public.loyalty_comments enable row level security;

-- Автора не підробити: id і email беруться із сесії, при правці не змінюються
create or replace function public.loyalty_comments_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.author_id := auth.uid();
    new.author_email := (select p.email from public.profiles p where p.id = auth.uid());
    new.created_at := now();
  else
    new.author_id := old.author_id;
    new.author_email := old.author_email;
    new.item_key := old.item_key;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists loyalty_comments_stamp on public.loyalty_comments;
create trigger loyalty_comments_stamp
  before insert or update on public.loyalty_comments
  for each row execute function public.loyalty_comments_stamp();

drop policy if exists loyalty_comments_read on public.loyalty_comments;
drop policy if exists loyalty_comments_insert on public.loyalty_comments;
drop policy if exists loyalty_comments_update on public.loyalty_comments;
drop policy if exists loyalty_comments_delete on public.loyalty_comments;

create policy loyalty_comments_read on public.loyalty_comments
  for select to authenticated using ((select public.is_admin()));
create policy loyalty_comments_insert on public.loyalty_comments
  for insert to authenticated with check ((select public.is_admin()));
-- правити й видаляти — лише свої
create policy loyalty_comments_update on public.loyalty_comments
  for update to authenticated
  using ((select public.is_admin()) and author_id = (select auth.uid()))
  with check ((select public.is_admin()) and author_id = (select auth.uid()));
create policy loyalty_comments_delete on public.loyalty_comments
  for delete to authenticated
  using ((select public.is_admin()) and author_id = (select auth.uid()));

revoke all on public.loyalty_comments from anon;
