import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');
const migration = read('supabase/migrations/20261025_security_hardening.sql');
const rollback = read('supabase/rollback/20261025_security_hardening_rollback.sql');
const schema = read('supabase/schema.sql');

// These are text checks only: they do not run the SQL. Run the manual checklist in
// docs/SECURITY_MIGRATION.md against the real database after applying the migration.
describe('security hardening migration (text checks)', () => {
  it('runs in one transaction', () => {
    expect(migration).toMatch(/^BEGIN;$/m);
    expect(migration).toMatch(/^COMMIT;$/m);
    expect(rollback).toMatch(/^BEGIN;$/m);
    expect(rollback).toMatch(/^COMMIT;$/m);
  });

  it('blocks joining or leaving anything that is not an open planning order (SEC-04)', () => {
    const guard = "v_order_record.status IS DISTINCT FROM 'planning' OR v_order_record.is_archived = true";
    expect(migration.split(guard)).toHaveLength(3);
    expect(migration).not.toContain("IS DISTINCT FROM 'planning' AND v_order_record.is_archived = true");
    expect(rollback).toContain("IS DISTINCT FROM 'planning' AND v_order_record.is_archived = true");
  });

  it('keeps the full name separate from the email when creating a person (SEC-16)', () => {
    expect(migration).toContain('SELECT full_name, email INTO v_full_name, v_user_email');
    expect(migration).not.toContain('INTO v_user_email, v_user_email');
  });

  it('only offers people from workspaces the user belongs to (SEC-01)', () => {
    expect(migration).toContain('AND public.is_workspace_member(p.workspace_id)');
    expect(rollback).not.toContain('is_workspace_member(p.workspace_id)');
  });

  it('locks profile email and phone for signed-in API users, but not signup or the SQL editor (SEC-01)', () => {
    expect(migration).toContain('BEFORE UPDATE ON public.profiles');
    expect(migration).toContain('IF auth.uid() IS NOT NULL');
    expect(migration).toContain('NEW.email IS DISTINCT FROM OLD.email');
    expect(migration).toContain('NEW.phone IS DISTINCT FROM OLD.phone');
    expect(rollback).toContain('DROP TRIGGER IF EXISTS trg_lock_profile_identity ON public.profiles;');
  });

  it('pins the search path of the creator-participant trigger function (SEC-11)', () => {
    expect(migration).toContain('ALTER FUNCTION public._add_order_creator_participant() SET search_path = public;');
    expect(rollback).toContain('ALTER FUNCTION public._add_order_creator_participant() RESET search_path;');
  });

  it('limits logo size and type and scopes writes to the workspace folder (SEC-06)', () => {
    expect(migration).toContain('file_size_limit = 5242880');
    expect(migration).toContain("ARRAY['image/png', 'image/jpeg', 'image/webp']");
    expect(migration.match(/\(storage\.foldername\(name\)\)\[2\] = public\.user_workspace_id\(\)::text/g)?.length).toBe(4);
    expect(rollback).toContain('file_size_limit = NULL');
  });

  it('is mirrored in schema.sql', () => {
    expect(schema).toContain('_lock_profile_identity');
    expect(schema).toContain("IS DISTINCT FROM 'planning' OR v_order_record.is_archived = true");
    expect(schema).toContain('AND public.is_workspace_member(p.workspace_id)');
  });
});
