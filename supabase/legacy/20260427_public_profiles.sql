create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  username text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_unique_idx
on public.profiles(username)
where username is not null;

create index if not exists profiles_public_username_idx
on public.profiles(username)
where is_public = true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_username_format'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
    add constraint profiles_username_format
    check (
      username is null
      or username ~ '^[a-z0-9_-]{3,30}$'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_display_name_length'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
    add constraint profiles_display_name_length
    check (
      display_name is null
      or char_length(display_name) <= 80
    );
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Public can read public profiles" on public.profiles;
create policy "Public can read public profiles"
on public.profiles
for select
to anon, authenticated
using (is_public = true);

alter table public.items enable row level security;

drop policy if exists "Enable read access for all users by owner ID" on public.items;
drop policy if exists "Public can read items for public profiles" on public.items;
create policy "Public can read items for public profiles"
on public.items
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = items.user_id
      and profiles.is_public = true
  )
);
