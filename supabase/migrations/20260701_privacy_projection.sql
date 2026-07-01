-- Privacy projection for Coffee Splitter.
-- Run this in Supabase SQL Editor if the database does not already include
-- order_participant_people(uuid, jsonb).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.orders
SET owner_id = created_by
WHERE owner_id IS NULL
  AND created_by IS NOT NULL;

CREATE OR REPLACE FUNCTION public.order_participant_people(
  p_payer_id uuid,
  p_lots jsonb
)
RETURNS TABLE (person_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT participant_ids.person_id
  FROM (
    SELECT p_payer_id AS person_id
    WHERE p_payer_id IS NOT NULL

    UNION ALL

    SELECT NULLIF(share->>'personId', '')::uuid AS person_id
    FROM jsonb_array_elements(coalesce(p_lots, '[]'::jsonb)) lot
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(lot->'shares', '[]'::jsonb)) share
    WHERE coalesce((share->>'shareGrams')::integer, 0) > 0
      AND NULLIF(share->>'personId', '') IS NOT NULL

    UNION ALL

    SELECT NULLIF(participant->>'personId', '')::uuid AS person_id
    FROM jsonb_array_elements(coalesce(p_lots, '[]'::jsonb)) lot
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(lot->'bagAllocations', '[]'::jsonb)) allocation
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(allocation->'participants', '[]'::jsonb)) participant
    WHERE coalesce((participant->>'shareGrams')::integer, 0) > 0
      AND NULLIF(participant->>'personId', '') IS NOT NULL

    UNION ALL

    SELECT NULLIF(buyer->>'personId', '')::uuid AS person_id
    FROM jsonb_array_elements(coalesce(p_lots, '[]'::jsonb)) lot
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(lot->'bags', '[]'::jsonb)) bag
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(bag->'buyers', '[]'::jsonb)) buyer
    WHERE coalesce((buyer->>'grams')::integer, 0) > 0
      AND NULLIF(buyer->>'personId', '') IS NOT NULL
  ) participant_ids
  WHERE participant_ids.person_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.is_order_full_viewer(
  p_workspace_id uuid,
  p_owner_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_owner_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.workspace_id = p_workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    );
$$;

CREATE OR REPLACE FUNCTION public.order_participant_people_for_order(
  p_payer_id uuid,
  p_lots jsonb,
  p_fees jsonb,
  p_payments jsonb
)
RETURNS TABLE (person_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT person_id FROM public.order_participant_people(p_payer_id, p_lots)

  UNION

  SELECT NULLIF(fee->>'personId', '')::uuid AS person_id
  FROM jsonb_array_elements(coalesce(p_fees, '[]'::jsonb)) fee
  WHERE fee->>'allocationType' IN ('specific_person')
    AND coalesce((fee->>'amountZar')::numeric, 0) > 0
    AND NULLIF(fee->>'personId', '') IS NOT NULL

  UNION

  SELECT key::uuid AS person_id
  FROM jsonb_each(coalesce(p_payments, '{}'::jsonb))
  WHERE value->>'status' IN ('paid', 'partial');
$$;

CREATE OR REPLACE FUNCTION public.can_access_order(
  p_workspace_id uuid,
  p_order_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = p_order_id
        AND o.workspace_id = p_workspace_id
        AND public.is_order_full_viewer(o.workspace_id, coalesce(o.owner_id, o.created_by))
    )
    OR EXISTS (
      SELECT 1
      FROM public.order_participants op
      WHERE op.order_id = p_order_id
        AND op.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.sync_order_participants(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.orders
    WHERE id = p_order_id
  ) THEN
    RETURN;
  END IF;

  DELETE FROM public.order_participants op
  WHERE op.order_id = p_order_id
    AND NOT EXISTS (
      WITH order_row AS (
        SELECT id, workspace_id, payer_id, lots, fees, payments
        FROM public.orders
        WHERE id = p_order_id
      ),
      participant_users AS (
        SELECT DISTINCT o.id AS order_id, p.linked_user_id AS user_id
        FROM order_row o
        JOIN LATERAL public.order_participant_people_for_order(o.payer_id, o.lots, o.fees, o.payments) pp ON true
        JOIN public.people p
          ON p.id = pp.person_id
         AND p.workspace_id = o.workspace_id
        WHERE p.linked_user_id IS NOT NULL
      )
      SELECT 1
      FROM participant_users pu
      WHERE pu.order_id = op.order_id
        AND pu.user_id = op.user_id
    );

  INSERT INTO public.order_participants (order_id, user_id)
  WITH order_row AS (
    SELECT id, workspace_id, payer_id, lots, fees, payments
    FROM public.orders
    WHERE id = p_order_id
  ),
  participant_users AS (
    SELECT DISTINCT o.id AS order_id, p.linked_user_id AS user_id
    FROM order_row o
    JOIN LATERAL public.order_participant_people_for_order(o.payer_id, o.lots, o.fees, o.payments) pp ON true
    JOIN public.people p
      ON p.id = pp.person_id
     AND p.workspace_id = o.workspace_id
    WHERE p.linked_user_id IS NOT NULL
  )
  SELECT pu.order_id, pu.user_id
  FROM participant_users pu
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_participant_orders()
RETURNS TABLE (
  id uuid,
  workspace_id uuid,
  name text,
  order_date date,
  roaster_id uuid,
  roaster_snapshot jsonb,
  payer_id uuid,
  payer_bank jsonb,
  reference_template text,
  payer_note text,
  goods_total_zar numeric,
  lots jsonb,
  fees jsonb,
  payments jsonb,
  is_archived boolean,
  owner_id uuid,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH linked_person AS (
    SELECT p.id AS person_id
    FROM public.people p
    WHERE p.linked_user_id = auth.uid()
    LIMIT 1
  )
  SELECT
    o.id,
    o.workspace_id,
    o.name,
    o.order_date,
    o.roaster_id,
    o.roaster_snapshot,
    CASE WHEN o.payer_id = lp.person_id THEN o.payer_id ELSE NULL END AS payer_id,
    o.payer_bank,
    o.reference_template,
    o.payer_note,
    o.goods_total_zar,
    coalesce((
      SELECT jsonb_agg(lot)
      FROM jsonb_array_elements(o.lots) lot
      WHERE EXISTS (
        SELECT 1
        FROM jsonb_array_elements(coalesce(lot->'shares', '[]'::jsonb)) share
        WHERE share->>'personId' = lp.person_id::text
      )
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(coalesce(lot->'bags', '[]'::jsonb)) bag
        JOIN LATERAL jsonb_array_elements(coalesce(bag->'buyers', '[]'::jsonb)) buyer ON true
        WHERE buyer->>'personId' = lp.person_id::text
      )
    ), '[]'::jsonb) AS lots,
    coalesce((
      SELECT jsonb_agg(fee)
      FROM jsonb_array_elements(o.fees) fee
      WHERE fee->>'allocationType' IN ('equal_per_person', 'proportional_by_value', 'fixed_shared', 'value_based')
        OR (fee->>'allocationType' = 'specific_person' AND fee->>'personId' = lp.person_id::text)
    ), '[]'::jsonb) AS fees,
    CASE
      WHEN o.payments ? lp.person_id::text THEN jsonb_build_object(lp.person_id::text, o.payments -> lp.person_id::text)
      ELSE '{}'::jsonb
    END AS payments,
    o.is_archived,
    NULL::uuid AS owner_id,
    NULL::uuid AS created_by,
    o.created_at,
    o.updated_at
  FROM public.orders o
  JOIN public.order_participants op
    ON op.order_id = o.id
   AND op.user_id = auth.uid()
  CROSS JOIN linked_person lp
  WHERE NOT public.is_order_full_viewer(o.workspace_id, coalesce(o.owner_id, o.created_by));
$$;

DROP POLICY IF EXISTS "Members can view orders" ON public.orders;
DROP POLICY IF EXISTS "Members can update orders" ON public.orders;
DROP POLICY IF EXISTS "Members can delete orders" ON public.orders;

CREATE POLICY "Members can view orders"
  ON public.orders FOR SELECT
  USING (public.is_order_full_viewer(workspace_id, coalesce(owner_id, created_by)));

CREATE POLICY "Members can update orders"
  ON public.orders FOR UPDATE
  USING (public.is_order_full_viewer(workspace_id, coalesce(owner_id, created_by)))
  WITH CHECK (public.is_order_full_viewer(workspace_id, coalesce(owner_id, created_by)));

CREATE POLICY "Members can delete orders"
  ON public.orders FOR DELETE
  USING (public.is_order_full_viewer(workspace_id, coalesce(owner_id, created_by)));

DO $$
DECLARE
  v_order_id uuid;
BEGIN
  FOR v_order_id IN
    SELECT id
    FROM public.orders
  LOOP
    PERFORM public.sync_order_participants(v_order_id);
  END LOOP;
END;
$$;
