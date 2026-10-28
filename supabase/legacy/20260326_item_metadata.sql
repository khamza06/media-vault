alter table public.items
add column if not exists total_progress integer,
add column if not exists notes text,
add column if not exists started_at date,
add column if not exists completed_at date;
