-- Phase 5 (notifications) support columns.
--
-- vet_profiles has no email column and farmer_profiles has no user_id
-- column, so there's no reliable join from a vet's auth user_id back to
-- their email anywhere in the current schema — needed to notify a vet a
-- farmer specifically requested by id, before any vet_appointments row
-- (which denormalizes vet_email) exists yet. Adding it directly, populated
-- going forward whenever a vet saves their profile (src/pages/VetProfileSetup.jsx).

alter table public.vet_profiles
  add column if not exists email text;

-- Appointment reminders: flips true once a reminder notification has been
-- sent for an appointment, checked opportunistically when a vet loads
-- their appointments list (src/pages/Appointments.jsx) rather than via a
-- scheduled job — see the Phase 5 plan for why.
alter table public.vet_appointments
  add column if not exists reminder_sent boolean not null default false;
