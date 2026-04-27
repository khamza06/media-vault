alter table public.lists
add column if not exists is_public boolean not null default false;

alter table public.lists
add column if not exists slug text;

create unique index if not exists lists_user_slug_unique
on public.lists(user_id, slug)
where slug is not null;

create index if not exists lists_public_user_slug_idx
on public.lists(user_id, slug)
where is_public = true and slug is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lists_slug_format'
      and conrelid = 'public.lists'::regclass
  ) then
    alter table public.lists
    add constraint lists_slug_format
    check (
      slug is null
      or slug ~ '^[a-z0-9_-]{3,60}$'
    );
  end if;
end $$;

alter table public.lists enable row level security;
alter table public.list_items enable row level security;

drop policy if exists "Public can read public lists for public profiles" on public.lists;
create policy "Public can read public lists for public profiles"
on public.lists
for select
to anon, authenticated
using (
  is_public = true
  and exists (
    select 1
    from public.profiles
    where profiles.id = lists.user_id
      and profiles.is_public = true
  )
);

drop policy if exists "Public can read items in public lists" on public.list_items;
create policy "Public can read items in public lists"
on public.list_items
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.lists
    join public.profiles on profiles.id = lists.user_id
    where lists.id = list_items.list_id
      and lists.is_public = true
      and profiles.is_public = true
  )
);
