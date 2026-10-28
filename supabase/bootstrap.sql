-- Verified metadata snapshot from production, 2026-10-28 (no user data).
-- EMPTY SUPABASE PROJECT ONLY. Then apply supabase/migrations in order.
-- This baseline is deliberately outside the migration ledger: never apply it
-- to production or fabricate historical migration entries.
BEGIN;
DO $$ BEGIN
  IF to_regclass('public.items') IS NOT NULL OR to_regclass('public.lists') IS NOT NULL
    OR to_regclass('public.profiles') IS NOT NULL OR to_regclass('public.list_items') IS NOT NULL THEN
    RAISE EXCEPTION 'Bootstrap requires an empty application schema';
  END IF;
END $$;

CREATE TABLE public."items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "type" text NOT NULL,
  "status" text DEFAULT 'Planning'::text,
  "progress" integer DEFAULT 0,
  "rating" integer,
  "image_url" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "user_id" uuid,
  "total_progress" integer,
  "notes" text,
  "started_at" date,
  "completed_at" date,
  "favorite" boolean DEFAULT false NOT NULL,
  "genres" text[] DEFAULT '{}'::text[] NOT NULL,
  "external_rating_label" text,
  "external_rating_value" numeric,
  "external_source" text,
  "external_id" text,
  "external_url" text
);

CREATE TABLE public."lists" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "is_public" boolean DEFAULT false NOT NULL,
  "slug" text
);

CREATE TABLE public."profiles" (
  "id" uuid NOT NULL,
  "display_name" text,
  "username" text,
  "is_public" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."list_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "list_id" uuid NOT NULL,
  "item_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public."items" ADD CONSTRAINT "items_pkey" PRIMARY KEY (id);
ALTER TABLE public."list_items" ADD CONSTRAINT "list_items_list_id_item_id_key" UNIQUE (list_id, item_id);
ALTER TABLE public."list_items" ADD CONSTRAINT "list_items_pkey" PRIMARY KEY (id);
ALTER TABLE public."lists" ADD CONSTRAINT "lists_pkey" PRIMARY KEY (id);
ALTER TABLE public."lists" ADD CONSTRAINT "lists_slug_format" CHECK (((slug IS NULL) OR (slug ~ '^[a-z0-9_-]{3,60}$'::text)));
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_display_name_length" CHECK (((display_name IS NULL) OR (char_length(display_name) <= 80)));
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id);
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_username_format" CHECK (((username IS NULL) OR (username ~ '^[a-z0-9_-]{3,30}$'::text)));
ALTER TABLE public."items" ADD CONSTRAINT "items_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."list_items" ADD CONSTRAINT "list_items_item_id_fkey" FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE;
ALTER TABLE public."list_items" ADD CONSTRAINT "list_items_list_id_fkey" FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE;
ALTER TABLE public."list_items" ADD CONSTRAINT "list_items_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."lists" ADD CONSTRAINT "lists_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX items_user_id_idx ON public.items USING btree (user_id);
CREATE INDEX lists_user_id_updated_at_idx ON public.lists USING btree (user_id, updated_at DESC);
CREATE UNIQUE INDEX lists_user_slug_unique ON public.lists USING btree (user_id, slug) WHERE (slug IS NOT NULL);
CREATE INDEX lists_public_user_slug_idx ON public.lists USING btree (user_id, slug) WHERE ((is_public = true) AND (slug IS NOT NULL));
CREATE INDEX list_items_user_id_list_id_idx ON public.list_items USING btree (user_id, list_id);
CREATE INDEX list_items_item_id_idx ON public.list_items USING btree (item_id);
CREATE UNIQUE INDEX profiles_username_unique_idx ON public.profiles USING btree (username) WHERE (username IS NOT NULL);
CREATE INDEX profiles_public_username_idx ON public.profiles USING btree (username) WHERE (is_public = true);
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
CREATE TRIGGER set_lists_updated_at BEFORE UPDATE ON public.lists FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE public."items" ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public."items" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."items" TO authenticated;
ALTER TABLE public."lists" ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public."lists" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."lists" TO authenticated;
ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public."profiles" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."profiles" TO authenticated;
ALTER TABLE public."list_items" ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public."list_items" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."list_items" TO authenticated;
CREATE POLICY "Users can update own lists" ON "public"."lists" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete own lists" ON "public"."lists" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((auth.uid() = user_id));
CREATE POLICY "Users can view own list items" ON "public"."list_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert own list items" ON "public"."list_items" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM lists
  WHERE ((lists.id = list_items.list_id) AND (lists.user_id = auth.uid())))) AND (EXISTS ( SELECT 1
   FROM items
  WHERE ((items.id = list_items.item_id) AND (items.user_id = auth.uid()))))));
CREATE POLICY "Users can delete own list items" ON "public"."list_items" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((auth.uid() = user_id));
CREATE POLICY "Users can view own items" ON "public"."items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert own items" ON "public"."items" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update own items" ON "public"."items" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete own items" ON "public"."items" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((auth.uid() = user_id));
CREATE POLICY "Users can view own lists" ON "public"."lists" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert own lists" ON "public"."lists" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view own profile" ON "public"."profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid() = id));
CREATE POLICY "Users can insert own profile" ON "public"."profiles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users can update own profile" ON "public"."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));
CREATE POLICY "Public can read public profiles" ON "public"."profiles" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ((is_public = true));
CREATE POLICY "Public can read public lists for public profiles" ON "public"."lists" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (((is_public = true) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = lists.user_id) AND (profiles.is_public = true))))));

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('media-covers','media-covers',true,5242880,ARRAY['image/jpeg','image/png','image/webp','image/gif']);
CREATE POLICY "Authenticated users can delete own covers" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'media-covers'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid))));
CREATE POLICY "Authenticated users can update own covers" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'media-covers'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid)))) WITH CHECK (((bucket_id = 'media-covers'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid))));
CREATE POLICY "Authenticated users can upload own covers" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'media-covers'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid))));
CREATE POLICY "Public can view media covers" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((bucket_id = 'media-covers'::text));
COMMIT;
