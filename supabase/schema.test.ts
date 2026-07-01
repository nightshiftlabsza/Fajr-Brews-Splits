import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve(process.cwd(), 'supabase/schema.sql'), 'utf8');
const finalAccessSection = schema.slice(schema.indexOf('DROP FUNCTION IF EXISTS public.set_order_pin(uuid, text);'));

describe('supabase schema access rules', () => {
  it('uses a PIN-free can_access_order signature and decision', () => {
    expect(finalAccessSection).toContain('DROP FUNCTION IF EXISTS public.can_access_order(uuid, uuid, boolean);');
    expect(finalAccessSection).toContain('CREATE OR REPLACE FUNCTION public.can_access_order(');
    expect(finalAccessSection).toContain('p_workspace_id uuid,');
    expect(finalAccessSection).toContain('p_order_id uuid');
    expect(finalAccessSection).not.toContain('AND NOT coalesce(p_pin_required, false)');
    expect(finalAccessSection).toContain('public.is_workspace_member(p_workspace_id)');
    expect(finalAccessSection).toContain('FROM public.order_participants op');
  });

  it('removes legacy PIN RPCs from the final schema surface', () => {
    expect(finalAccessSection).toContain('DROP FUNCTION IF EXISTS public.set_order_pin(uuid, text);');
    expect(finalAccessSection).toContain('DROP FUNCTION IF EXISTS public.clear_order_pin(uuid);');
    expect(finalAccessSection).toContain('DROP FUNCTION IF EXISTS public.verify_order_pin(uuid, text);');
    expect(finalAccessSection).toContain('Deprecated compatibility column. Finalized-order access no longer depends on PIN state.');
  });

  it('keeps participant matching priority in email, phone, then unique-safe name order', () => {
    expect(schema).toContain("'email'::text AS match_reason");
    expect(schema).toContain('1 AS match_rank');
    expect(schema).toContain("'phone'::text AS match_reason");
    expect(schema).toContain('2 AS match_rank');
    expect(schema).toContain("'name'::text AS match_reason");
    expect(schema).toContain('3 AS match_rank');
    expect(schema).toContain('AND NOT EXISTS (');
    expect(schema).toContain('FROM email_matches');
    expect(schema).toContain('FROM phone_matches');
    expect(schema).toContain('dup.normalized_name = ep.normalized_name');
  });

  it('syncs participant access from payer, lot shares, bag allocations, and bag buyers', () => {
    expect(finalAccessSection).toContain("SELECT p_payer_id AS person_id");
    expect(finalAccessSection).toContain("lot->'shares'");
    expect(finalAccessSection).toContain("lot->'bagAllocations'");
    expect(finalAccessSection).toContain("allocation->'participants'");
    expect(finalAccessSection).toContain("lot->'bags'");
    expect(finalAccessSection).toContain("bag->'buyers'");
    expect(finalAccessSection).toContain('order_participant_people_for_order');
    expect(finalAccessSection).toContain("fee->>'allocationType' IN ('specific_person')");
    expect(finalAccessSection).toContain("value->>'status' IN ('paid', 'partial')");
  });

  it('updates order policies to use the PIN-free access helper', () => {
    expect(finalAccessSection).toContain('CREATE OR REPLACE FUNCTION public.get_my_participant_orders()');
    expect(finalAccessSection).toContain('USING (public.is_order_full_viewer(workspace_id, coalesce(owner_id, created_by)))');
    expect(finalAccessSection).toContain('WHERE NOT public.is_order_full_viewer');
  });
});
