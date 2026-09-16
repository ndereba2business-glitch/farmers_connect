-- Read-only diagnostic — run in the Supabase SQL editor and paste the
-- output back. Not a migration; not meant to be applied via CLI.

-- 1. Which tables have RLS enabled at all?
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'vet_appointments', 'vet_profiles', 'visit_records',
    'vet_blocked_dates', 'farmer_profiles', 'notifications', 'vet_questions'
  )
order by tablename;

-- 2. Every policy currently defined on those tables.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'vet_appointments', 'vet_profiles', 'visit_records',
    'vet_blocked_dates', 'farmer_profiles', 'notifications', 'vet_questions'
  )
order by tablename, policyname;
