insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media-covers',
  'media-covers',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view media covers" on storage.objects;
create policy "Public can view media covers"
on storage.objects
for select
to public
using (bucket_id = 'media-covers');

drop policy if exists "Authenticated users can upload own covers" on storage.objects;
create policy "Authenticated users can upload own covers"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'media-covers'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Authenticated users can update own covers" on storage.objects;
create policy "Authenticated users can update own covers"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'media-covers'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'media-covers'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Authenticated users can delete own covers" on storage.objects;
create policy "Authenticated users can delete own covers"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'media-covers'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
