alter table public.items
add column if not exists external_rating_label text;

alter table public.items
add column if not exists external_rating_value numeric;
