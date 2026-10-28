alter table public.items enable row level security;

drop policy if exists "Enable read access for all users by owner ID" on public.items;

create policy "Enable read access for all users by owner ID"
on public.items
for select
to anon, authenticated
using (true);
