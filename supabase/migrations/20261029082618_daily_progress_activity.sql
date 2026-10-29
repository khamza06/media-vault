-- Additive rollout: no historical backfill, no item/profile/list policy changes.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';

CREATE TABLE public.progress_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  media_type text NOT NULL,
  from_progress integer NOT NULL,
  to_progress integer NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (from_progress IS DISTINCT FROM to_progress)
);
CREATE INDEX progress_events_owner_recent_idx
  ON public.progress_events(user_id, occurred_at DESC, id DESC);
CREATE INDEX progress_events_item_idx ON public.progress_events(item_id);
ALTER TABLE public.progress_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.progress_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.progress_events TO authenticated;
CREATE POLICY "Owners read their progress history" ON public.progress_events
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

-- Private trigger is the only journal writer. A failed journal insert rolls
-- back the progress update too. Notes, ratings and historical rows are untouched.
CREATE FUNCTION media_vault_private.record_progress_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF coalesce(NEW.progress,0) <> coalesce(OLD.progress,0) AND NEW.user_id IS NOT NULL THEN
    NEW.last_progress_at := pg_catalog.clock_timestamp();
    INSERT INTO public.progress_events(user_id, item_id, media_type, from_progress, to_progress, occurred_at)
    VALUES (NEW.user_id, NEW.id, coalesce(NEW.type,'Unknown'), coalesce(OLD.progress, 0), coalesce(NEW.progress, 0), NEW.last_progress_at);
  ELSE
    NEW.last_progress_at := OLD.last_progress_at;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION media_vault_private.record_progress_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER record_progress_change BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION media_vault_private.record_progress_change();

-- Compare-and-swap under a row lock: stale devices and lost-response retries
-- return the current state instead of applying the same increment again.
CREATE FUNCTION public.advance_item_progress(
  p_item_id uuid, p_expected_progress integer, p_expected_last_progress_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' SET lock_timeout = '3s' AS $$
DECLARE
  current_item record;
  outcome text;
  ceiling_value integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501'; END IF;
  IF p_expected_progress IS NULL OR p_expected_progress < 0 THEN
    RAISE EXCEPTION 'Invalid progress' USING ERRCODE = '22023';
  END IF;
  SELECT id, type, status, progress, total_progress, last_progress_at INTO current_item
    FROM public.items WHERE id=p_item_id AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  ceiling_value := CASE WHEN current_item.type='Movie' THEN 1 ELSE nullif(current_item.total_progress, 0) END;
  IF coalesce(current_item.progress,0)<>p_expected_progress
     OR current_item.last_progress_at IS DISTINCT FROM p_expected_last_progress_at THEN
    outcome := 'conflict';
  ELSIF coalesce(current_item.progress,0)>=2147483647
     OR (ceiling_value>0 AND coalesce(current_item.progress,0)>=ceiling_value) THEN
    outcome := 'complete';
  ELSE
    UPDATE public.items SET
      progress=coalesce(current_item.progress,0)+1,
      total_progress=CASE WHEN current_item.type='Movie' THEN 1 ELSE current_item.total_progress END,
      status=CASE
        WHEN current_item.type='Movie' THEN 'Completed'
        WHEN coalesce(current_item.status,'Planning')='Planning' AND current_item.type IN ('Book','Manga','Manhwa','Manhua') THEN 'Reading'
        WHEN coalesce(current_item.status,'Planning')='Planning' THEN 'Watching'
        ELSE current_item.status END
    WHERE id=p_item_id AND user_id=auth.uid()
    RETURNING id,type,status,progress,total_progress,last_progress_at INTO current_item;
    IF NOT FOUND THEN RETURN NULL; END IF;
    outcome := 'updated';
  END IF;
  RETURN pg_catalog.jsonb_build_object('id',current_item.id,'progress',current_item.progress,
    'total_progress',current_item.total_progress,'status',current_item.status,
    'last_progress_at',current_item.last_progress_at,'outcome',outcome);
END;
$$;
REVOKE ALL ON FUNCTION public.advance_item_progress(uuid,integer,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_item_progress(uuid,integer,timestamptz) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;

-- Rollback application first; archive the new journal if needed. Detach the
-- trigger and drop the two new functions. Retain progress_events and all rows.
-- Do not reset timestamps, revert progress, or weaken the existing RLS/view.
