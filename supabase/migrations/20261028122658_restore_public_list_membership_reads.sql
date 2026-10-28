-- Public list contents require explicit visibility and consistent ownership.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10s';
DROP POLICY IF EXISTS "Public can read items in public lists" ON public.list_items;
CREATE POLICY "Public can read items in public lists"
ON public.list_items
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.lists AS l
    JOIN public.profiles AS p ON p.id = l.user_id
    JOIN public.items AS i
      ON i.id = list_items.item_id AND i.user_id = l.user_id
    WHERE l.id = list_items.list_id
      AND list_items.user_id = l.user_id
      AND l.is_public = true
      AND p.is_public = true
      AND l.slug IS NOT NULL
  )
);
COMMIT;
