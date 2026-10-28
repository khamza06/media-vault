-- Forward-only reconciliation. Do not replay the archived March/April scripts:
-- those add redundant counters, rewrite movie progress, and reopen item reads.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';

-- Nullable, no default/backfill: historical progress dates are unknown.
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS last_progress_at timestamptz;
CREATE INDEX IF NOT EXISTS items_user_last_progress_at_idx
  ON public.items (user_id, last_progress_at DESC NULLS LAST);

-- Replace only the old NULL placeholder. Same fields, visibility and privileges
-- as P0; personal notes and external_url remain excluded.
CREATE OR REPLACE VIEW public.public_items
WITH (security_barrier = true, security_invoker = false) AS
SELECT i.id, i.user_id, i.title, i.type, i.status, i.progress,
  i.total_progress, i.last_progress_at, i.rating, i.image_url,
  i.started_at, i.completed_at, i.favorite, i.genres,
  i.external_rating_label, i.external_rating_value,
  i.external_source, i.external_id, i.created_at
FROM public.items AS i
JOIN public.profiles AS p ON p.id = i.user_id
WHERE p.is_public = true;
ALTER VIEW public.public_items OWNER TO postgres;
REVOKE ALL ON public.public_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_items TO anon, authenticated;
COMMENT ON COLUMN public.items.last_progress_at IS
  'Last actual tracking change. NULL for pre-migration history; never inferred from creation date.';
NOTIFY pgrst, 'reload schema';
COMMIT;
