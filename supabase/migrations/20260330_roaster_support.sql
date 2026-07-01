-- ============================================================
-- Fajr Brews - Roaster support patch
-- Apply this to existing Supabase projects that were created
-- before roaster support was added to the app.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.roasters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  logo_path text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roasters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'handle_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS roasters_updated_at ON public.roasters;
    CREATE TRIGGER roasters_updated_at
      BEFORE UPDATE ON public.roasters
      FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS roaster_id uuid REFERENCES public.roasters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS roaster_snapshot jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS roasters_workspace_normalized_name_key
  ON public.roasters (
    workspace_id,
    lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
  );

DROP POLICY IF EXISTS "Members can view roasters" ON public.roasters;
CREATE POLICY "Members can view roasters"
  ON public.roasters FOR SELECT
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Members can insert roasters" ON public.roasters;
CREATE POLICY "Members can insert roasters"
  ON public.roasters FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Members can update roasters" ON public.roasters;
CREATE POLICY "Members can update roasters"
  ON public.roasters FOR UPDATE
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Members can delete roasters" ON public.roasters;
CREATE POLICY "Members can delete roasters"
  ON public.roasters FOR DELETE
  USING (public.is_workspace_member(workspace_id));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'roasters'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.roasters';
  END IF;
END;
$$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('roaster-logos', 'roaster-logos', true)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public;

DROP POLICY IF EXISTS "Authenticated users can upload roaster logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload roaster logos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'roaster-logos'
    AND public.user_workspace_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "Authenticated users can update roaster logos" ON storage.objects;
CREATE POLICY "Authenticated users can update roaster logos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'roaster-logos'
    AND public.user_workspace_id() IS NOT NULL
  )
  WITH CHECK (
    bucket_id = 'roaster-logos'
    AND public.user_workspace_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "Authenticated users can delete roaster logos" ON storage.objects;
CREATE POLICY "Authenticated users can delete roaster logos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'roaster-logos'
    AND public.user_workspace_id() IS NOT NULL
  );
