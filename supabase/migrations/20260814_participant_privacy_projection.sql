-- Migration: 20260814_participant_privacy_projection.sql
-- Server-side participant privacy projection for Fajr Brews
-- Safe and non-destructive: only replaces the RPC function get_my_participant_orders.
-- Does NOT delete, truncate, or mutate any stored orders, people, or user data.

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
  ),
  participant_orders AS (
    SELECT o.*, lp.person_id AS me_id
    FROM public.orders o
    JOIN public.order_participants op
      ON op.order_id = o.id
     AND op.user_id = auth.uid()
    CROSS JOIN linked_person lp
    WHERE NOT public.is_order_full_viewer(o.workspace_id, coalesce(o.owner_id, o.created_by))
  )
  SELECT
    po.id,
    po.workspace_id,
    po.name,
    po.order_date,
    po.roaster_id,
    po.roaster_snapshot,
    CASE WHEN po.payer_id = po.me_id THEN po.payer_id ELSE NULL END AS payer_id,
    po.payer_bank,
    po.reference_template,
    po.payer_note,
    coalesce((
      SELECT sum(coalesce((lot->>'foreignPricePerBag')::numeric, 0) * coalesce((
        SELECT sum(coalesce((buyer->>'grams')::numeric, 0)) / nullif(coalesce((lot->>'gramsPerBag')::numeric, 1), 0)
        FROM jsonb_array_elements(coalesce(lot->'bags', '[]'::jsonb)) bag
        CROSS JOIN LATERAL jsonb_array_elements(coalesce(bag->'buyers', '[]'::jsonb)) buyer
        WHERE buyer->>'personId' = po.me_id::text
      ), 0))
      FROM jsonb_array_elements(po.lots) lot
      WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(coalesce(lot->'bags', '[]'::jsonb)) bag
        CROSS JOIN LATERAL jsonb_array_elements(coalesce(bag->'buyers', '[]'::jsonb)) buyer
        WHERE buyer->>'personId' = po.me_id::text
      ) OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(coalesce(lot->'shares', '[]'::jsonb)) share
        WHERE share->>'personId' = po.me_id::text
      )
    ), po.goods_total_zar) AS goods_total_zar,
    coalesce((
      SELECT jsonb_agg(
        jsonb_set(
          jsonb_set(
            lot,
            '{shares}',
            coalesce((
              SELECT jsonb_agg(share)
              FROM jsonb_array_elements(coalesce(lot->'shares', '[]'::jsonb)) share
              WHERE share->>'personId' = po.me_id::text
            ), '[]'::jsonb)
          ),
          '{bags}',
          coalesce((
            SELECT jsonb_agg(
              jsonb_set(
                bag,
                '{buyers}',
                coalesce((
                  SELECT jsonb_agg(buyer)
                  FROM jsonb_array_elements(coalesce(bag->'buyers', '[]'::jsonb)) buyer
                  WHERE buyer->>'personId' = po.me_id::text
                ), '[]'::jsonb)
              )
            )
            FROM jsonb_array_elements(coalesce(lot->'bags', '[]'::jsonb)) bag
            WHERE EXISTS (
              SELECT 1
              FROM jsonb_array_elements(coalesce(bag->'buyers', '[]'::jsonb)) buyer
              WHERE buyer->>'personId' = po.me_id::text
            )
          ), '[]'::jsonb)
        )
      )
      FROM jsonb_array_elements(po.lots) lot
      WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(coalesce(lot->'shares', '[]'::jsonb)) share
        WHERE share->>'personId' = po.me_id::text
      )
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(coalesce(lot->'bags', '[]'::jsonb)) bag
        CROSS JOIN LATERAL jsonb_array_elements(coalesce(bag->'buyers', '[]'::jsonb)) buyer
        WHERE buyer->>'personId' = po.me_id::text
      )
    ), '[]'::jsonb) AS lots,
    coalesce((
      SELECT jsonb_agg(fee)
      FROM jsonb_array_elements(po.fees) fee
      WHERE fee->>'allocationType' IN ('equal_per_person', 'proportional_by_value', 'fixed_shared', 'value_based')
         OR (fee->>'allocationType' = 'specific_person' AND fee->>'personId' = po.me_id::text)
    ), '[]'::jsonb) AS fees,
    CASE
      WHEN po.payments ? po.me_id::text THEN jsonb_build_object(po.me_id::text, po.payments -> po.me_id::text)
      ELSE '{}'::jsonb
    END AS payments,
    po.is_archived,
    NULL::uuid AS owner_id,
    NULL::uuid AS created_by,
    po.created_at,
    po.updated_at
  FROM participant_orders po;
$$;
