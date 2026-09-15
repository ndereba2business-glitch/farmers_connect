-- Phase 3 (vet-farmer workflow) + Phase 4.2 (vet availability)
--
-- This is the first migration file in this repo — past schema (vet_appointments,
-- vet_profiles, farmer_profiles, notifications, etc.) was created directly in the
-- Supabase dashboard and is NOT captured here. This migration only adds what's new.
--
-- ASSUMPTIONS (could not verify against live schema — Supabase MCP was unavailable
-- all session, connection kept closing before OAuth could complete):
--   - vet_appointments.id is uuid (every frontend query treats appointment ids as
--     opaque values via .eq("id", appt.id), never parses them as integers)
--   - vet_profiles has a user_id uuid column (confirmed via VetProfileSetup.jsx:
--     .eq("user_id", user.id) / upsert with onConflict: "user_id")
-- Run this in the Supabase SQL editor and check for errors on the two
-- `references` lines first — if either fails, tell me the actual column type
-- and I'll adjust.

-- ============================================================
-- 3.1 — Appointment rejection reason
-- ============================================================
alter table public.vet_appointments
  add column if not exists rejection_reason text;

-- ============================================================
-- 3.2 — Visit execution record (1:1 with an appointment)
-- ============================================================
create table if not exists public.visit_records (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.vet_appointments(id) on delete cascade,
  vet_id uuid,
  vet_email text,
  farmer_id uuid,
  farmer_email text,
  symptoms text,
  diagnosis text,
  treatment text,
  medications jsonb not null default '[]'::jsonb,  -- [{name, dosage, instructions}]
  vet_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index columns used in RLS policies below (auth.uid()/auth.email() lookups)
-- and the two email columns the app already filters/joins on everywhere else.
create index if not exists visit_records_vet_id_idx on public.visit_records (vet_id);
create index if not exists visit_records_farmer_id_idx on public.visit_records (farmer_id);
create index if not exists visit_records_vet_email_idx on public.visit_records (vet_email);
create index if not exists visit_records_farmer_email_idx on public.visit_records (farmer_email);

alter table public.visit_records enable row level security;

create policy "Vets manage their own visit records" on public.visit_records
  for all
  using ((select auth.uid()) = vet_id or (select auth.email()) = vet_email)
  with check ((select auth.uid()) = vet_id or (select auth.email()) = vet_email);

create policy "Farmers view their own visit records" on public.visit_records
  for select
  using ((select auth.uid()) = farmer_id or (select auth.email()) = farmer_email);

-- ============================================================
-- 4.2 — Vet availability
-- ============================================================
alter table public.vet_profiles
  add column if not exists working_days int[] not null default '{1,2,3,4,5}'; -- 0=Sun..6=Sat

alter table public.vet_profiles
  add column if not exists available_start_time time not null default '08:00';

alter table public.vet_profiles
  add column if not exists available_end_time time not null default '17:00';

create table if not exists public.vet_blocked_dates (
  id uuid primary key default gen_random_uuid(),
  vet_id uuid not null,
  blocked_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (vet_id, blocked_date)
);

alter table public.vet_blocked_dates enable row level security;

create policy "Vets manage their own blocked dates" on public.vet_blocked_dates
  for all
  using ((select auth.uid()) = vet_id)
  with check ((select auth.uid()) = vet_id);

-- Any signed-in user can read blocked dates — needed so the booking UI can
-- show/avoid a vet's unavailable days without exposing anything sensitive.
create policy "Authenticated users can view blocked dates" on public.vet_blocked_dates
  for select
  to authenticated
  using (true);

-- ============================================================
-- Double-booking guard (DB-level backstop — the app also pre-checks before
-- accepting, to show a clean error instead of a raw constraint violation)
-- ============================================================
create unique index if not exists vet_appointments_no_double_book
  on public.vet_appointments (vet_id, appointment_date, appointment_time)
  where status = 'accepted' and vet_id is not null;
