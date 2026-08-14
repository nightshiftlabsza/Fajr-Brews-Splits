-- Migration: Add OrderStatus and secure join/leave functions for planned orders

-- ─── 1. Add status column to orders ──────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'planning'
  CHECK (status IN ('planning', 'locked', 'completed', 'archived'));

-- Backfill status based on existing is_archived boolean
UPDATE public.orders
SET status = 'archived'
WHERE is_archived = true AND status != 'archived';

UPDATE public.orders
SET status = 'planning'
WHERE (is_archived = false OR is_archived IS NULL) AND (status IS NULL OR status = 'archived');

-- Trigger to enforce synchronization between status and is_archived
CREATE OR REPLACE FUNCTION public._sync_order_status_and_archived()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'archived' THEN
    NEW.is_archived := true;
  ELSIF NEW.is_archived = true AND (OLD.is_archived IS DISTINCT FROM NEW.is_archived OR NEW.status IS NULL) THEN
    NEW.status := 'archived';
  ELSIF NEW.status IS NULL THEN
    NEW.status := 'planning';
    NEW.is_archived := false;
  ELSE
    NEW.is_archived := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_status ON public.orders;
CREATE TRIGGER trg_sync_order_status
  BEFORE INSERT OR UPDATE OF status, is_archived
  ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public._sync_order_status_and_archived();

-- ─── 2. RPC: join_planned_order ──────────────────────────────
-- Strictly verifies authentication, workspace membership, order existence, and planning status.
-- Resolves the authenticated user to an existing Person record before creating anything to prevent duplicates.
CREATE OR REPLACE FUNCTION public.join_planned_order(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
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

  IF v_order_record.status IS DISTINCT FROM 'planning' AND v_order_record.is_archived = true THEN
    RAISE EXCEPTION 'Order is no longer open for joining';
  END IF;

  -- 1. Check if user already has a linked person in this workspace
  SELECT id INTO v_person_id
  FROM public.people
  WHERE workspace_id = v_order_record.workspace_id
    AND linked_user_id = v_user_id
  LIMIT 1;

  -- 2. If not found, check if there is an unlinked Person with matching email in this workspace
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

  -- 3. If still no Person record exists for this user in this workspace, create ONE
  IF v_person_id IS NULL THEN
    SELECT full_name, email INTO v_user_email, v_user_email
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
      coalesce(nullif(v_user_email, ''), 'Participant'),
      v_user_email,
      v_user_id,
      now(),
      'manual'
    )
    RETURNING id INTO v_person_id;
  END IF;

  -- Insert into order_participants
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

-- ─── 3. RPC: leave_planned_order ──────────────────────────────
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

  IF v_order_record.status IS DISTINCT FROM 'planning' AND v_order_record.is_archived = true THEN
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
