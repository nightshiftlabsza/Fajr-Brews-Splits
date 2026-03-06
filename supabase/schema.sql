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
