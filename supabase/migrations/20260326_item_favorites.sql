alter table public.items
add column if not exists favorite boolean not null default false;
