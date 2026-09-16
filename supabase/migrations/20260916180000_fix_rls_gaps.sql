-- Security fixes from the Phase 6 RLS audit (does NOT touch the admin
-- role/user_metadata privilege-escalation issue — that needs its own
-- architectural fix, discussed separately, not bundled into this migration).
--
-- Findings, in order addressed below:
--
-- 1. vet_appointments had two generations of policies stacked together.
--    The legacy ones ("Vets manage own appointments select/update") use
--    `(auth.email() = vet_email) OR (vet_email IS NULL)` — that second
--    clause has no identity check at all. Since Postgres OR's all
--    permissive policies for a command together, this completely bypassed
--    the newer, correct "appointment select/update rules" policy (which
--    properly checks is_verified_vet() and requested_vet_id): any
--    authenticated user — any role, unverified or not — could see AND
--    claim any unassigned appointment. Dropping the legacy three
--    (select/update/insert) and replacing the insert with one that
--    actually covers both the vet-initiated and farmer-initiated cases.
--
-- 2. There was exactly one INSERT policy on vet_appointments, requiring
--    auth.email() = vet_email. A farmer's own booking request
--    (Bookings.jsx submitBookingRequest) inserts vet_email: null — that
--    check evaluates to false against NULL, so farmer-initiated requests
--    were likely rejected outright. Fixed by the same replacement policy.
--
-- 3. farmer_profiles only had "owner_full_access" (a user can read/write
--    only their own row). MyFarmers.jsx (a vet reading a farmer's phone/
--    county/name for an appointment they're handling) had no way to
--    actually read that data — silently falling back to placeholder
--    values. Added a policy scoped to an actual appointment relationship,
--    not blanket cross-user access.
--
-- 4. vet_questions' emergency-question policies were just `is_emergency =
--    true` with no identity check — any authenticated user, not just
--    vets, could read and update any emergency question. Scoped to
--    is_verified_vet(), the same DB-backed (not self-reported) check
--    vet_appointments already uses elsewhere.

-- ============================================================
-- 1 & 2 — vet_appointments: drop the over-broad legacy policies,
-- replace the insert policy with one covering both directions.
-- ============================================================
drop policy if exists "Vets manage own appointments select" on public.vet_appointments;
drop policy if exists "Vets manage own appointments update" on public.vet_appointments;
drop policy if exists "Vets manage own appointments insert" on public.vet_appointments;

create policy "appointment insert rules" on public.vet_appointments
  for insert
  with check (
    (vet_id = (select auth.uid()))
    or (vet_email = coalesce((select auth.email()), (select auth.jwt() ->> 'phone')))
    or (farmer_id = (select auth.uid()))
    or (farmer_email = coalesce((select auth.email()), (select auth.jwt() ->> 'phone')))
  );

-- ============================================================
-- 3 — farmer_profiles: let a vet read a farmer's profile only where a
-- vet_appointments row actually links them together.
-- ============================================================
create policy "vets can view farmers they have appointments with" on public.farmer_profiles
  for select
  using (
    exists (
      select 1 from public.vet_appointments a
      where a.farmer_email = farmer_profiles.user_email
        and (
          a.vet_id = (select auth.uid())
          or a.vet_email = coalesce((select auth.email()), (select auth.jwt() ->> 'phone'))
        )
    )
  );

-- ============================================================
-- 4 — vet_questions: scope emergency-question access to verified vets.
-- ============================================================
drop policy if exists "Vets can view emergency questions" on public.vet_questions;
drop policy if exists "Vets can update emergency questions" on public.vet_questions;

create policy "verified vets can view emergency questions" on public.vet_questions
  for select
  using (is_emergency = true and is_verified_vet((select auth.uid())));

create policy "verified vets can respond to emergency questions" on public.vet_questions
  for update
  using (is_emergency = true and is_verified_vet((select auth.uid())))
  with check (is_emergency = true and is_verified_vet((select auth.uid())));
