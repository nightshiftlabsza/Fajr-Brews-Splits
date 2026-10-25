# Security migration: how to apply it

This is for the owner to run by hand. No agent or tool should run it.

What it fixes, in plain words:
1. People can no longer change the email or phone saved on their own profile, which was a way to claim someone else's person record.
2. Only people in your workspace can be matched to a person record.
3. Nobody can join or leave an order that is locked, completed or archived.
4. A person created by joining an order keeps their real name instead of their email address.
5. Roaster logos are limited to PNG, JPEG or WebP, 5 MB, and only inside your workspace folder. (The app currently also offers SVG. A follow-up code change removes that.)
6. One database function gets a fixed search path.

## Steps
1. **Back up first.** In Supabase: Database, Backups (or Settings, Database, download a backup). Wait for it to finish.
2. Open the SQL editor, paste the whole of `supabase/migrations/20261025_security_hardening.sql`, and run it. It is all-or-nothing: if it errors, nothing changes. Send me the error text.
3. Check it worked: run each query below.

```sql
-- should show: search_path=public
select proconfig from pg_proc where proname = '_add_order_creator_participant';

-- should return 1 row
select tgname from pg_trigger where tgname = 'trg_lock_profile_identity';

-- should show 5242880 and the three image types
select file_size_limit, allowed_mime_types from storage.buckets where id = 'roaster-logos';
```

4. Click through the real app once: sign in, open an active order, open Past Orders, add a roaster logo (PNG), join a planning order with a second account if you can.
5. If anything is wrong, paste `supabase/rollback/20261025_security_hardening_rollback.sql` into the SQL editor and run it, then tell me.

## Please also check (cannot be seen from the code)
- Supabase, Authentication, Providers, Email: is "Confirm email" switched on? It should be.
- Is the function `get_my_participant_orders` hiding other people's bag details? (Open it in Database, Functions; the live copy should only list allowed fields.)

## Not changed yet (need your decision)
- Any workspace member can edit or delete any person record.
- A workspace admin can remove the workspace owner.
