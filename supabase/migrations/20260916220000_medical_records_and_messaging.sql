-- Verified vets can search any farmer's profile, not just ones they
-- already share an appointment with. Without this, VetDashboard.jsx's
-- existing "Schedule Visit" farmer search (and the new FarmerPicker this
-- migration's features depend on) can only ever find farmers the vet has
-- already worked with — a new consult, walk-in, or first-time message
-- could never find its target. Mirrors the existing "anyone can view
-- verified vets" policy on vet_profiles, in the other direction.
create policy "verified vets can view farmer profiles" on public.farmer_profiles
  for select
  using (is_verified_vet((select auth.uid())));

-- Standalone medical records (prescription/diagnosis/vaccination/lab_result)
-- for VetDashboard.jsx's Quick Actions — not tied to a specific
-- appointment, since a vet may prescribe/diagnose/vaccinate/log a lab
-- result for a farmer outside a formal scheduled visit (phone consult,
-- walk-in, follow-up). visit_records (an earlier migration) stays the
-- record tied to completing a specific scheduled appointment.
create table public.vet_medical_records (
  id uuid primary key default gen_random_uuid(),
  vet_id uuid,
  vet_email text,
  farmer_id uuid,
  farmer_email text not null,
  appointment_id uuid references public.vet_appointments(id) on delete set null,
  record_type text not null check (record_type in ('prescription','diagnosis','vaccination','lab_result')),
  title text not null,
  details jsonb not null default '{}'::jsonb,
  -- details shape by record_type:
  --   prescription: { medication, dosage, instructions }
  --   diagnosis:    { diagnosis, notes }
  --   vaccination:  { vaccine_name, date_administered }
  --   lab_result:   { test_name, notes }
  next_due_date date, -- vaccination only; a real column so it can eventually
                       -- feed supabase/functions/send-vaccine-reminder,
                       -- which exists but is currently unwired to anything
  file_path text, -- lab_result only: storage object path, not a public URL
  created_at timestamptz not null default now()
);

create index vet_medical_records_vet_id_idx on public.vet_medical_records (vet_id);
create index vet_medical_records_farmer_id_idx on public.vet_medical_records (farmer_id);
create index vet_medical_records_vet_email_idx on public.vet_medical_records (vet_email);
create index vet_medical_records_farmer_email_idx on public.vet_medical_records (farmer_email);

alter table public.vet_medical_records enable row level security;

create policy "vets manage their own medical records" on public.vet_medical_records
  for all
  using (
    (select auth.uid()) = vet_id
    or coalesce((select auth.email()), (select auth.jwt() ->> 'phone')) = vet_email
  )
  with check (
    (select auth.uid()) = vet_id
    or coalesce((select auth.email()), (select auth.jwt() ->> 'phone')) = vet_email
  );

create policy "farmers view their own medical records" on public.vet_medical_records
  for select
  using (
    (select auth.uid()) = farmer_id
    or coalesce((select auth.email()), (select auth.jwt() ->> 'phone')) = farmer_email
  );

-- 1:1 vet-farmer messaging (VetDashboard.jsx's "Message Farmer" quick
-- action). Community.jsx/CommunityChat.jsx are public boards, not a fit
-- for a private conversation — reusing their Realtime pattern, not their
-- schema.
create table public.vet_farmer_messages (
  id uuid primary key default gen_random_uuid(),
  vet_id uuid,
  vet_email text not null,
  farmer_id uuid,
  farmer_email text not null,
  sender_email text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index vet_farmer_messages_pair_idx on public.vet_farmer_messages (vet_email, farmer_email, created_at);

alter table public.vet_farmer_messages enable row level security;

create policy "participants can read their conversation" on public.vet_farmer_messages
  for select
  using (
    coalesce((select auth.email()), (select auth.jwt() ->> 'phone')) in (vet_email, farmer_email)
    or (select auth.uid()) in (vet_id, farmer_id)
  );

create policy "participants can send messages" on public.vet_farmer_messages
  for insert
  with check (
    sender_email = coalesce((select auth.email()), (select auth.jwt() ->> 'phone'))
    and (
      coalesce((select auth.email()), (select auth.jwt() ->> 'phone')) in (vet_email, farmer_email)
      or (select auth.uid()) in (vet_id, farmer_id)
    )
  );

create policy "participants can mark messages read" on public.vet_farmer_messages
  for update
  using (coalesce((select auth.email()), (select auth.jwt() ->> 'phone')) in (vet_email, farmer_email))
  with check (coalesce((select auth.email()), (select auth.jwt() ->> 'phone')) in (vet_email, farmer_email));

-- Lab result files: run this SEPARATELY in the Supabase dashboard —
-- Storage buckets aren't created via SQL migrations in this repo.
--   1. Storage → New bucket → name "lab-results" → Public: OFF
--   2. Then run the two storage.objects policies below (SQL editor):
--
-- create policy "vet and farmer can view their own lab result files"
--   on storage.objects for select
--   using (
--     bucket_id = 'lab-results'
--     and exists (
--       select 1 from public.vet_medical_records r
--       where r.file_path = storage.objects.name
--         and (
--           r.vet_id = (select auth.uid()) or r.vet_email = coalesce((select auth.email()), (select auth.jwt() ->> 'phone'))
--           or r.farmer_id = (select auth.uid()) or r.farmer_email = coalesce((select auth.email()), (select auth.jwt() ->> 'phone'))
--         )
--     )
--   );
--
-- create policy "vets can upload lab result files" on storage.objects
--   for insert
--   with check (bucket_id = 'lab-results' and (select auth.uid()) is not null);
