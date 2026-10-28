-- Intentional definer view: expose only a fixed, public-profile projection.
-- No notes, SELECT *, user-supplied SQL or write privileges. No data is moved.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10s';
DO $migration$
DECLARE progress_date text;
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'items'
      AND column_name = 'last_progress_at'
  ) THEN 'i.last_progress_at' ELSE 'NULL::timestamptz' END INTO progress_date;
  EXECUTE format($view$
    CREATE VIEW public.public_items
    WITH (security_barrier = true, security_invoker = false) AS
    SELECT i.id, i.user_id, i.title, i.type, i.status, i.progress,
      i.total_progress, %s AS last_progress_at, i.rating, i.image_url,
      i.started_at, i.completed_at, i.favorite, i.genres,
      i.external_rating_label, i.external_rating_value,
      i.external_source, i.external_id, i.created_at
    FROM public.items AS i
    JOIN public.profiles AS p ON p.id = i.user_id
    WHERE p.is_public = true
  $view$, progress_date);
END;
$migration$;
ALTER VIEW public.public_items OWNER TO postgres;
REVOKE ALL ON public.public_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_items TO anon, authenticated;
COMMENT ON VIEW public.public_items IS
  'Intentional security-barrier definer projection: public profiles only, no personal notes, SELECT-only API. Base items remain owner-only.';
NOTIFY pgrst, 'reload schema';
COMMIT;
