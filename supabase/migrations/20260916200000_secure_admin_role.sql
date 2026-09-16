-- Fixes the admin-role privilege escalation found in the Phase 6 RLS
-- audit: admin authority was checked via user_metadata.role, which is
-- client-settable (any user can call supabase.auth.updateUser({data:
-- {role:'admin'}}) themselves). Moves it to app_metadata, which only the
-- Supabase dashboard/SQL editor or the service-role key can set — never
-- the authenticated client.

-- Grant real admin to the account the user wants going forward.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
where email = 'ndereducation2025@gmail.com';

-- Strip the stale self-reported claim from the old admin account — after
-- the AuthContext.jsx fix it would be ignored anyway, but no reason to
-- leave a misleading claim sitting in the data.
update auth.users
set raw_user_meta_data = raw_user_meta_data - 'role'
where email = 'userfarmersconnect@gmail.com';

-- Re-point vet_profiles' two admin policies at app_metadata instead of
-- user_metadata.
drop policy if exists "admin can update vet verification" on public.vet_profiles;
drop policy if exists "admin can view all vet profiles" on public.vet_profiles;

create policy "admin can update vet verification" on public.vet_profiles
  for update
  using (coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin')
  with check (coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin');

create policy "admin can view all vet profiles" on public.vet_profiles
  for select
  using (coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin');

-- New admin-read policies for two tables AdminDashboard.jsx already reads
-- but that never had admin access granted at all (read-only — the
-- dashboard doesn't write to either), found in the same audit.
create policy "admin can view all farmer profiles" on public.farmer_profiles
  for select
  using (coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin');

create policy "admin can view all farm batches" on public.farm_batches
  for select
  using (coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin');
