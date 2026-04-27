alter table public.items
add column if not exists genres text[] not null default '{}';
