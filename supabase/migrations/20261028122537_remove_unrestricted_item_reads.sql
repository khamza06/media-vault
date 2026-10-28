-- Keep owner-only and explicitly public-profile reads. Never restore USING (true).
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10s';
DROP POLICY IF EXISTS "Allow public read access" ON public.items;
DROP POLICY IF EXISTS "Enable read access for all users by owner ID" ON public.items;
COMMIT;
