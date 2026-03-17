-- ============================================================
-- Fajr Brews — Coffee Splitter: Supabase Schema
-- Run this in the Supabase SQL Editor (Project > SQL Editor)
-- ============================================================

-- ─── Extensions ─────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Tables ──────────────────────────────────────────────────

-- User profiles (auto-created on signup via trigger)
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text,
  created_at timestamptz default now()
);

-- Workspaces (groups)
create table if not exists public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,
  created_at timestamptz default now()
);

-- Workspace membership
create table if not exists public.workspace_members (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at   timestamptz default now(),
  unique (workspace_id, user_id)
);

-- Shared people directory (per workspace)
create table if not exists public.people (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null,
  phone        text,
  email        text,
  note         text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Orders (per workspace; lots/fees/payments stored as JSONB)
create table if not exists public.orders (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces(id) on delete cascade,
  name                 text not null,
  order_date           date not null,
  payer_id             uuid references public.people(id) on delete set null,
  payer_bank           jsonb not null default '{}',
  reference_template   text not null default 'FAJR-{ORDER}-{NAME}',
  payer_note           text,
  goods_total_zar      numeric(14,4) not null default 0,
  lots                 jsonb not null default '[]',
  fees                 jsonb not null default '[]',
  payments             jsonb not null default '{}',
  is_archived          boolean not null default false,
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- App settings per user (theme, last export date, etc.)
create table if not exists public.user_settings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid unique not null references auth.users(id) on delete cascade,
  theme            text not null default 'porcelain' check (theme in ('porcelain','obsidian','slate')),
  last_export_date timestamptz,
  updated_at       timestamptz default now()
);

-- ─── Updated-at Trigger ──────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger people_updated_at
  before update on public.people
  for each row execute procedure public.handle_updated_at();

create trigger orders_updated_at
  before update on public.orders
  for each row execute procedure public.handle_updated_at();

create trigger settings_updated_at
  before update on public.user_settings
  for each row execute procedure public.handle_updated_at();

-- ─── Auto-create Profile on Signup ──────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── RLS: Enable ─────────────────────────────────────────────
alter table public.profiles          enable row level security;
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.people            enable row level security;
alter table public.orders            enable row level security;
alter table public.user_settings     enable row level security;

-- ─── Helper Function ─────────────────────────────────────────
create or replace function public.user_workspace_id()
returns uuid language sql stable security definer set search_path = public as $$
  select workspace_id
  from public.workspace_members
  where user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_workspace_member(ws_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$;

-- ─── RLS Policies: profiles ──────────────────────────────────
create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- Workspace members can look up other profiles by email (for admin invite)
create policy "Members can view profiles in same workspace"
  on public.profiles for select
  using (
    id in (
      select user_id from public.workspace_members
      where workspace_id = public.user_workspace_id()
    )
  );

-- ─── RLS Policies: workspaces ────────────────────────────────
create policy "Members can view their workspace"
  on public.workspaces for select
  using (public.is_workspace_member(id));

-- ─── RLS Policies: workspace_members ────────────────────────
create policy "Members can view membership list"
  on public.workspace_members for select
  using (workspace_id = public.user_workspace_id());

create policy "Admins can insert workspace members"
  on public.workspace_members for insert
  with check (
    workspace_id = public.user_workspace_id()
    and exists (
      select 1 from public.workspace_members
      where workspace_id = public.user_workspace_id()
      and user_id = auth.uid()
      and role in ('owner', 'admin')
    )
  );

create policy "Admins can delete workspace members"
  on public.workspace_members for delete
  using (
    workspace_id = public.user_workspace_id()
    and exists (
      select 1 from public.workspace_members
      where workspace_id = public.user_workspace_id()
      and user_id = auth.uid()
      and role in ('owner', 'admin')
    )
  );

-- ─── RLS Policies: people ────────────────────────────────────
create policy "Members can view people"
  on public.people for select
  using (public.is_workspace_member(workspace_id));

create policy "Members can insert people"
  on public.people for insert
  with check (public.is_workspace_member(workspace_id));

create policy "Members can update people"
  on public.people for update
  using (public.is_workspace_member(workspace_id));

create policy "Members can delete people"
  on public.people for delete
  using (public.is_workspace_member(workspace_id));

-- ─── RLS Policies: orders ────────────────────────────────────
create policy "Members can view orders"
  on public.orders for select
  using (public.is_workspace_member(workspace_id));

create policy "Members can insert orders"
  on public.orders for insert
  with check (public.is_workspace_member(workspace_id));

create policy "Members can update orders"
  on public.orders for update
  using (public.is_workspace_member(workspace_id));

create policy "Members can delete orders"
  on public.orders for delete
  using (public.is_workspace_member(workspace_id));

-- ─── RLS Policies: user_settings ─────────────────────────────
create policy "Users manage own settings"
  on public.user_settings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── Realtime ────────────────────────────────────────────────
-- Enable realtime on the shared tables
-- (also enable in Dashboard > Database > Replication)
alter publication supabase_realtime add table public.people;
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.workspace_members;

-- ─── Seed: Fajr Brews Workspace ──────────────────────────────
-- Creates the workspace. Run ONCE.
insert into public.workspaces (id, name, slug)
values (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'Fajr Brews',
  'fajr-brews'
) on conflict (slug) do nothing;

-- ─── Notes ───────────────────────────────────────────────────
-- After running this schema:
-- 1. Sign up in the app with your email/password.
-- 2. Get your user UUID from: Auth > Users in the Supabase dashboard.
-- 3. Run the INSERT below with your actual UUID to make yourself owner:
--
--   insert into public.workspace_members (workspace_id, user_id, role)
--   values ('a1b2c3d4-0000-0000-0000-000000000001', 'YOUR-USER-UUID-HERE', 'owner');
--
-- 4. Reload the app — you should now have full access.
-- 5. Add other members via the Settings > Members page in the app,
--    or repeat the INSERT above with their UUIDs and role = 'member'.

-- ============================================================
-- MIGRATION 001 — Theme Overhaul + Order PIN Access
-- Run this in Supabase SQL Editor AFTER the initial schema above.
-- Safe to run multiple times (uses IF NOT EXISTS / DO NOTHING).
-- ============================================================

-- ─── 1. Update user_settings theme constraint ─────────────────
ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_theme_check;

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_theme_check
    CHECK (theme IN ('emerald', 'yinmn'));

ALTER TABLE public.user_settings
  ALTER COLUMN theme SET DEFAULT 'emerald';

-- Migrate any existing rows to new theme names
UPDATE public.user_settings SET theme = 'emerald'
  WHERE theme NOT IN ('emerald', 'yinmn');

-- ─── 2. Add theme_mode column to user_settings ────────────────
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS theme_mode text NOT NULL DEFAULT 'light';

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_theme_mode_check;

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_theme_mode_check
    CHECK (theme_mode IN ('light', 'dark', 'auto'));

-- ─── 3. Add PIN columns to orders ────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pin_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pin_hash text;

-- ─── 4. Create order_participants table ──────────────────────
CREATE TABLE IF NOT EXISTS public.order_participants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, user_id)
);

ALTER TABLE public.order_participants ENABLE ROW LEVEL SECURITY;

-- Participants can see their own rows
DROP POLICY IF EXISTS "op_select" ON public.order_participants;
CREATE POLICY "op_select" ON public.order_participants
  FOR SELECT USING (auth.uid() = user_id);

-- Existing participants can add others (within same workspace)
DROP POLICY IF EXISTS "op_insert" ON public.order_participants;
CREATE POLICY "op_insert" ON public.order_participants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.order_participants op2
      WHERE op2.order_id = order_participants.order_id
        AND op2.user_id = auth.uid()
    )
  );

-- Only the user themselves can be removed
DROP POLICY IF EXISTS "op_delete" ON public.order_participants;
CREATE POLICY "op_delete" ON public.order_participants
  FOR DELETE USING (auth.uid() = user_id);

-- ─── 5. Auto-add creator as participant on INSERT ─────────────
CREATE OR REPLACE FUNCTION public._add_order_creator_participant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.order_participants (order_id, user_id)
  VALUES (NEW.id, auth.uid())
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_creator_participant ON public.orders;
CREATE TRIGGER trg_order_creator_participant
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public._add_order_creator_participant();

-- ─── 6. Backfill: add current workspace members as participants
--        for all existing orders (run once; safe if re-run)
INSERT INTO public.order_participants (order_id, user_id)
SELECT o.id, wm.user_id
FROM public.orders o
JOIN public.workspace_members wm ON wm.workspace_id = o.workspace_id
ON CONFLICT DO NOTHING;

-- ─── 7. RPC: set_order_pin ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_order_pin(p_order_id uuid, p_pin text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.order_participants
    WHERE order_id = p_order_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  UPDATE public.orders SET
    pin_required = true,
    pin_hash = crypt(p_pin, gen_salt('bf'))
  WHERE id = p_order_id;
END;
$$;

-- ─── 8. RPC: clear_order_pin ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.clear_order_pin(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.order_participants
    WHERE order_id = p_order_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  UPDATE public.orders SET
    pin_required = false,
    pin_hash = NULL
  WHERE id = p_order_id;
END;
$$;

-- ─── 9. RPC: verify_order_pin ────────────────────────────────
CREATE OR REPLACE FUNCTION public.verify_order_pin(p_order_id uuid, p_pin text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_hash    text;
  v_req     boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.order_participants
    WHERE order_id = p_order_id AND user_id = auth.uid()
  ) THEN
    RETURN false;
  END IF;
  SELECT pin_hash, pin_required INTO v_hash, v_req
  FROM public.orders WHERE id = p_order_id;
  IF NOT v_req OR v_hash IS NULL THEN RETURN true; END IF;
  RETURN v_hash = crypt(p_pin, v_hash);
END;
$$;

-- ─── 10. RPC: add_order_participant ──────────────────────────
CREATE OR REPLACE FUNCTION public.add_order_participant(p_order_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.order_participants
    WHERE order_id = p_order_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  INSERT INTO public.order_participants (order_id, user_id)
  VALUES (p_order_id, p_user_id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- ============================================================
-- MIGRATION 002 — Derived Order Protection
-- ============================================================

CREATE OR REPLACE FUNCTION public.normalize_email(p_email text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(lower(btrim(coalesce(p_email, ''))), '');
$$;

CREATE OR REPLACE FUNCTION public.can_access_order(
  p_workspace_id uuid,
  p_order_id uuid,
  p_pin_required boolean
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_workspace_member(p_workspace_id)
    AND (
      NOT coalesce(p_pin_required, false)
      OR EXISTS (
        SELECT 1
        FROM public.order_participants
        WHERE order_id = p_order_id
          AND user_id = auth.uid()
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.sync_order_participants(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
        SELECT id, workspace_id, payer_id, lots
        FROM public.orders
        WHERE id = p_order_id
      ),
      participant_people AS (
        SELECT DISTINCT participant_ids.person_id
        FROM (
          SELECT payer_id AS person_id
          FROM order_row
          WHERE payer_id IS NOT NULL

          UNION ALL

          SELECT NULLIF(share->>'personId', '')::uuid AS person_id
          FROM order_row o
          CROSS JOIN LATERAL jsonb_array_elements(o.lots) lot
          CROSS JOIN LATERAL jsonb_array_elements(coalesce(lot->'shares', '[]'::jsonb)) share
          WHERE coalesce((share->>'shareGrams')::integer, 0) > 0
            AND NULLIF(share->>'personId', '') IS NOT NULL
        ) participant_ids
        WHERE participant_ids.person_id IS NOT NULL
      ),
      participant_users AS (
        SELECT DISTINCT o.id AS order_id, wm.user_id
        FROM order_row o
        JOIN participant_people pp ON true
        JOIN public.people p
          ON p.id = pp.person_id
         AND p.workspace_id = o.workspace_id
        JOIN public.workspace_members wm
          ON wm.workspace_id = o.workspace_id
        JOIN public.profiles pr
          ON pr.id = wm.user_id
        WHERE public.normalize_email(p.email) IS NOT NULL
          AND public.normalize_email(p.email) = public.normalize_email(pr.email)
      )
      SELECT 1
      FROM participant_users pu
      WHERE pu.order_id = op.order_id
        AND pu.user_id = op.user_id
    );

  INSERT INTO public.order_participants (order_id, user_id)
  WITH order_row AS (
    SELECT id, workspace_id, payer_id, lots
    FROM public.orders
    WHERE id = p_order_id
  ),
  participant_people AS (
    SELECT DISTINCT participant_ids.person_id
    FROM (
      SELECT payer_id AS person_id
      FROM order_row
      WHERE payer_id IS NOT NULL

      UNION ALL

      SELECT NULLIF(share->>'personId', '')::uuid AS person_id
      FROM order_row o
      CROSS JOIN LATERAL jsonb_array_elements(o.lots) lot
      CROSS JOIN LATERAL jsonb_array_elements(coalesce(lot->'shares', '[]'::jsonb)) share
      WHERE coalesce((share->>'shareGrams')::integer, 0) > 0
        AND NULLIF(share->>'personId', '') IS NOT NULL
    ) participant_ids
    WHERE participant_ids.person_id IS NOT NULL
  ),
  participant_users AS (
    SELECT DISTINCT o.id AS order_id, wm.user_id
    FROM order_row o
    JOIN participant_people pp ON true
    JOIN public.people p
      ON p.id = pp.person_id
     AND p.workspace_id = o.workspace_id
    JOIN public.workspace_members wm
      ON wm.workspace_id = o.workspace_id
    JOIN public.profiles pr
      ON pr.id = wm.user_id
    WHERE public.normalize_email(p.email) IS NOT NULL
      AND public.normalize_email(p.email) = public.normalize_email(pr.email)
  )
  SELECT pu.order_id, pu.user_id
  FROM participant_users pu
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_workspace_order_participants(p_workspace_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id uuid;
BEGIN
  FOR v_order_id IN
    SELECT id
    FROM public.orders
    WHERE workspace_id = p_workspace_id
  LOOP
    PERFORM public.sync_order_participants(v_order_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public._sync_order_participants_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.sync_order_participants(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_participants ON public.orders;
CREATE TRIGGER trg_sync_order_participants
  AFTER INSERT OR UPDATE OF lots, payer_id, workspace_id
  ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public._sync_order_participants_trigger();

CREATE OR REPLACE FUNCTION public._sync_order_participants_from_person()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id uuid;
BEGIN
  FOR v_order_id IN
    SELECT o.id
    FROM public.orders o
    WHERE o.workspace_id = NEW.workspace_id
      AND (
        o.payer_id = NEW.id
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(o.lots) lot
          CROSS JOIN LATERAL jsonb_array_elements(coalesce(lot->'shares', '[]'::jsonb)) share
          WHERE share->>'personId' = NEW.id::text
        )
      )
  LOOP
    PERFORM public.sync_order_participants(v_order_id);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_participants_from_person ON public.people;
CREATE TRIGGER trg_sync_order_participants_from_person
  AFTER UPDATE OF email
  ON public.people
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public._sync_order_participants_from_person();

CREATE OR REPLACE FUNCTION public._sync_order_participants_from_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.sync_workspace_order_participants(coalesce(NEW.workspace_id, OLD.workspace_id));
  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_participants_from_membership ON public.workspace_members;
CREATE TRIGGER trg_sync_order_participants_from_membership
  AFTER INSERT OR DELETE
  ON public.workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION public._sync_order_participants_from_membership();

DROP POLICY IF EXISTS "op_insert" ON public.order_participants;
DROP POLICY IF EXISTS "op_delete" ON public.order_participants;

DROP POLICY IF EXISTS "Members can view orders" ON public.orders;
DROP POLICY IF EXISTS "Members can update orders" ON public.orders;
DROP POLICY IF EXISTS "Members can delete orders" ON public.orders;

CREATE POLICY "Members can view orders"
  ON public.orders FOR SELECT
  USING (public.can_access_order(workspace_id, id, pin_required));

CREATE POLICY "Members can update orders"
  ON public.orders FOR UPDATE
  USING (public.can_access_order(workspace_id, id, pin_required))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can delete orders"
  ON public.orders FOR DELETE
  USING (public.can_access_order(workspace_id, id, pin_required));

DROP FUNCTION IF EXISTS public.add_order_participant(uuid, uuid);

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
