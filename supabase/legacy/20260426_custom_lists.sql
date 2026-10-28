create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (list_id, item_id)
);

create index if not exists lists_user_id_updated_at_idx
on public.lists(user_id, updated_at desc);

create index if not exists list_items_user_id_list_id_idx
on public.list_items(user_id, list_id);

create index if not exists list_items_item_id_idx
on public.list_items(item_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_lists_updated_at on public.lists;
create trigger set_lists_updated_at
before update on public.lists
for each row
execute function public.set_updated_at();

alter table public.lists enable row level security;
alter table public.list_items enable row level security;

drop policy if exists "Users can view own lists" on public.lists;
create policy "Users can view own lists"
on public.lists
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own lists" on public.lists;
create policy "Users can insert own lists"
on public.lists
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own lists" on public.lists;
create policy "Users can update own lists"
on public.lists
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own lists" on public.lists;
create policy "Users can delete own lists"
on public.lists
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can view own list items" on public.list_items;
create policy "Users can view own list items"
on public.list_items
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own list items" on public.list_items;
create policy "Users can insert own list items"
on public.list_items
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.lists
    where lists.id = list_items.list_id
      and lists.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.items
    where items.id = list_items.item_id
      and items.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own list items" on public.list_items;
create policy "Users can delete own list items"
on public.list_items
for delete
to authenticated
using (auth.uid() = user_id);
