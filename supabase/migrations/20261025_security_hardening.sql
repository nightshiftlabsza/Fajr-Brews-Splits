-- Security hardening (SEC-01, SEC-04, SEC-06, SEC-11, SEC-16).
-- Run by hand in the Supabase SQL editor AFTER taking a backup. Never run by an agent.
-- Undo script: supabase/rollback/20261025_security_hardening_rollback.sql
-- Everything runs in one transaction: if any statement fails, nothing is changed.

BEGIN;

-- ─── SEC-04: join/leave guards must block anything that is not an open, planning order ───
CREATE OR REPLACE FUNCTION public.join_planned_order(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_full_name text;
  v_order_record public.orders%ROWTYPE;
  v_person_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to join an order';
  END IF;

  SELECT * INTO v_order_record
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF NOT public.is_workspace_member(v_order_record.workspace_id) THEN
    RAISE EXCEPTION 'Access denied: You must be a workspace member to join this order';
  END IF;

  IF v_order_record.status IS DISTINCT FROM 'planning' OR v_order_record.is_archived = true THEN
    RAISE EXCEPTION 'Order is no longer open for joining';
  END IF;

  SELECT id INTO v_person_id
  FROM public.people
  WHERE workspace_id = v_order_record.workspace_id
    AND linked_user_id = v_user_id
  LIMIT 1;

  IF v_person_id IS NULL THEN
    SELECT email INTO v_user_email
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_user_email IS NOT NULL AND v_user_email != '' THEN
      SELECT id INTO v_person_id
      FROM public.people
      WHERE workspace_id = v_order_record.workspace_id
        AND lower(trim(email)) = lower(trim(v_user_email))
      LIMIT 1;

      IF v_person_id IS NOT NULL THEN
        UPDATE public.people
        SET linked_user_id = v_user_id,
            linked_at = now(),
            link_source = 'email'
        WHERE id = v_person_id AND linked_user_id IS NULL;
      END IF;
    END IF;
  END IF;

  IF v_person_id IS NULL THEN
    -- SEC-16: keep the display name and the email in separate variables
    SELECT full_name, email INTO v_full_name, v_user_email
    FROM public.profiles
    WHERE id = v_user_id;

    INSERT INTO public.people (
      workspace_id,
      name,
      email,
      linked_user_id,
      linked_at,
      link_source
    )
    VALUES (
      v_order_record.workspace_id,
      coalesce(
        nullif(btrim(v_full_name), ''),
        nullif(split_part(coalesce(v_user_email, ''), '@', 1), ''),
        'Participant'
      ),
      v_user_email,
      v_user_id,
      now(),
      'manual'
    )
    RETURNING id INTO v_person_id;
  END IF;

  INSERT INTO public.order_participants (order_id, user_id)
  VALUES (p_order_id, v_user_id)
  ON CONFLICT (order_id, user_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'orderId', p_order_id,
    'personId', v_person_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_planned_order(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order_record public.orders%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_order_record
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order_record.status IS DISTINCT FROM 'planning' OR v_order_record.is_archived = true THEN
    RAISE EXCEPTION 'Cannot leave an order that is finalized or locked';
  END IF;

  IF v_order_record.owner_id = v_user_id OR v_order_record.created_by = v_user_id THEN
    RAISE EXCEPTION 'The order owner cannot leave the order. You can delete or archive it instead.';
  END IF;

  DELETE FROM public.order_participants
  WHERE order_id = p_order_id AND user_id = v_user_id;

  RETURN jsonb_build_object('success', true, 'orderId', p_order_id);
END;
$$;

-- ─── SEC-01: people can only be matched to a user inside workspaces that user belongs to ───
CREATE OR REPLACE FUNCTION public.get_my_person_link_candidates()
RETURNS TABLE (
  person_id uuid,
  workspace_id uuid,
  name text,
  email text,
  phone text,
  match_reason text,
  match_rank integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT
      auth.uid() AS user_id,
      public.normalize_email(pr.email) AS normalized_email,
      public.normalize_phone(pr.phone) AS normalized_phone,
      public.normalize_full_name(pr.full_name) AS normalized_name
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
  ),
  eligible_people AS (
    SELECT
      p.id,
      p.workspace_id,
      p.name,
      p.email,
      p.phone,
      public.normalize_email(p.email) AS normalized_email,
      public.normalize_phone(p.phone) AS normalized_phone,
      public.normalize_full_name(p.name) AS normalized_name
    FROM public.people p
    WHERE (p.linked_user_id IS NULL OR p.linked_user_id = auth.uid())
      AND public.is_workspace_member(p.workspace_id)
  ),
  email_matches AS (
    SELECT
      ep.id AS person_id,
      ep.workspace_id,
      ep.name,
      ep.email,
      ep.phone,
      'email'::text AS match_reason,
      1 AS match_rank
    FROM eligible_people ep
    CROSS JOIN me
    WHERE me.normalized_email IS NOT NULL
      AND ep.normalized_email IS NOT NULL
      AND ep.normalized_email = me.normalized_email
  ),
  phone_matches AS (
    SELECT
      ep.id AS person_id,
      ep.workspace_id,
      ep.name,
      ep.email,
      ep.phone,
      'phone'::text AS match_reason,
      2 AS match_rank
    FROM eligible_people ep
    CROSS JOIN me
    WHERE me.normalized_phone IS NOT NULL
      AND ep.normalized_phone IS NOT NULL
      AND ep.normalized_phone = me.normalized_phone
      AND NOT EXISTS (
        SELECT 1
        FROM email_matches em
        WHERE em.person_id = ep.id
      )
  ),
  name_matches AS (
    SELECT
      ep.id AS person_id,
      ep.workspace_id,
      ep.name,
      ep.email,
      ep.phone,
      'name'::text AS match_reason,
      3 AS match_rank
    FROM eligible_people ep
    CROSS JOIN me
    WHERE me.normalized_name IS NOT NULL
      AND ep.normalized_name = me.normalized_name
      AND ep.normalized_email IS NULL
      AND ep.normalized_phone IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM email_matches
      )
      AND NOT EXISTS (
        SELECT 1
        FROM phone_matches
      )
      AND NOT EXISTS (
        SELECT 1
        FROM eligible_people dup
        WHERE dup.id <> ep.id
          AND dup.workspace_id = ep.workspace_id
          AND dup.normalized_name = ep.normalized_name
      )
  )
  SELECT * FROM email_matches
  UNION ALL
  SELECT * FROM phone_matches
  UNION ALL
  SELECT * FROM name_matches;
$$;

-- ─── SEC-01: a signed-in user may not rewrite the email or phone their account is matched on ───
-- Requests made through the API carry a user id (auth.uid()); the signup trigger and the
-- SQL editor do not, so they keep working.
CREATE OR REPLACE FUNCTION public._lock_profile_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND (NEW.email IS DISTINCT FROM OLD.email OR NEW.phone IS DISTINCT FROM OLD.phone) THEN
    RAISE EXCEPTION 'Profile email and phone cannot be changed here';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_profile_identity ON public.profiles;
CREATE TRIGGER trg_lock_profile_identity
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public._lock_profile_identity();

-- ─── SEC-11: pin the search path of the security definer trigger function ───
ALTER FUNCTION public._add_order_creator_participant() SET search_path = public;

-- ─── SEC-06: roaster-logos bucket — size and type limits, and folder-scoped write access ───
-- The app uploads to workspace/<workspace id>/roasters/<roaster id>/<file>.
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']
WHERE id = 'roaster-logos';

DROP POLICY IF EXISTS "Authenticated users can upload roaster logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload roaster logos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'roaster-logos'
    AND (storage.foldername(name))[1] = 'workspace'
    AND (storage.foldername(name))[2] = public.user_workspace_id()::text
  );

DROP POLICY IF EXISTS "Authenticated users can update roaster logos" ON storage.objects;
CREATE POLICY "Authenticated users can update roaster logos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'roaster-logos'
    AND (storage.foldername(name))[1] = 'workspace'
    AND (storage.foldername(name))[2] = public.user_workspace_id()::text
  )
  WITH CHECK (
    bucket_id = 'roaster-logos'
    AND (storage.foldername(name))[1] = 'workspace'
    AND (storage.foldername(name))[2] = public.user_workspace_id()::text
  );

DROP POLICY IF EXISTS "Authenticated users can delete roaster logos" ON storage.objects;
CREATE POLICY "Authenticated users can delete roaster logos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'roaster-logos'
    AND (storage.foldername(name))[1] = 'workspace'
    AND (storage.foldername(name))[2] = public.user_workspace_id()::text
  );

COMMIT;
