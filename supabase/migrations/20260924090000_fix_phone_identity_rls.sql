-- Phone-number accounts could not save anything protected by an owner
-- policy ("new row violates row-level security policy for table
-- farm_batches", and the same on every other owner-scoped table).
--
-- Cause: 28 policies identify the caller with
--     coalesce(auth.email(), auth.jwt() ->> 'phone')
-- but Supabase puts "email": "" (empty, not null) in a phone user's token,
-- and auth.email() passes that empty string through. coalesce() only skips
-- NULL, so the identity became '' and never matched the phone number the
-- app stores in user_email / farmer_email / vet_email. Phone users were
-- rejected on insert and saw none of their own rows. It is also why no
-- phone user has a farmer_profiles row: the auto-create at login failed too.
-- visit_records compared auth.email() alone, with no phone fallback at all.
--
-- Fix: one helper that treats an empty claim as missing, and every
-- affected policy re-pointed at it with ALTER POLICY (name, command, roles
-- and permissiveness unchanged). The expressions below are the live
-- definitions as of 2026-09-24 with only the identity sub-expression
-- replaced; nothing else in them changes.
--
-- Email accounts are unaffected: for them the helper returns exactly what
-- auth.email() returned before. When a token has neither an email nor a
-- phone, the helper returns NULL, so it can never match a row.

create or replace function public.request_identity()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(auth.email(), ''),
    nullif(auth.jwt() ->> 'phone', '')
  )
$$;

comment on function public.request_identity() is
  'Signed-in user''s identity as stored in *_email columns: email, or phone (digits, no +) for phone-only accounts. NULL if neither.';

revoke all on function public.request_identity() from public, anon;
grant execute on function public.request_identity() to authenticated;

-- public.community_chat
alter policy "owner_write" on public."community_chat"
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

-- public.community_comments
alter policy "owner_write" on public."community_comments"
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

-- public.community_posts
alter policy "owner_write" on public."community_posts"
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

-- public.farm_batches
alter policy "owner_full_access" on public."farm_batches"
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

-- public.farm_finances
alter policy "owner_full_access" on public."farm_finances"
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

-- public.farm_gallery
alter policy "owner_full_access" on public."farm_gallery"
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

-- public.farm_tasks
alter policy "owner_full_access" on public."farm_tasks"
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

-- public.farmer_profiles
alter policy "owner_full_access" on public."farmer_profiles"
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

alter policy "vets can view farmers they have appointments with" on public."farmer_profiles"
  using ((EXISTS ( SELECT 1
   FROM public.vet_appointments a
  WHERE ((a.farmer_email = farmer_profiles.user_email) AND ((a.vet_id = ( SELECT auth.uid() AS uid)) OR (a.vet_email = (select public.request_identity())))))));

-- public.feed_calculations
alter policy "owner_full_access" on public."feed_calculations"
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

-- public.message_reactions
alter policy "owner_write" on public."message_reactions"
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

-- public.mortality_logs
alter policy "owner_full_access" on public."mortality_logs"
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

-- public.notifications
alter policy "owner_full_access" on public."notifications"
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

-- public.products
alter policy "owner_write" on public."products"
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

-- public.vaccination_tasks
alter policy "owner_full_access" on public."vaccination_tasks"
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

-- public.vet_appointments
alter policy "appointment insert rules" on public."vet_appointments"
  with check (((vet_id = ( SELECT auth.uid() AS uid)) OR (vet_email = (select public.request_identity())) OR (farmer_id = ( SELECT auth.uid() AS uid)) OR (farmer_email = (select public.request_identity()))));

alter policy "appointment select rules" on public."vet_appointments"
  using (((farmer_id = auth.uid()) OR (farmer_email = (select public.request_identity())) OR (vet_id = auth.uid()) OR (vet_email = (select public.request_identity())) OR ((vet_id IS NULL) AND (status = 'pending'::text) AND ((requested_vet_id IS NULL) OR (requested_vet_id = auth.uid())) AND public.is_verified_vet(auth.uid()))));

alter policy "appointment update rules" on public."vet_appointments"
  using (((vet_id = auth.uid()) OR (vet_email = (select public.request_identity())) OR ((vet_id IS NULL) AND (status = 'pending'::text) AND ((requested_vet_id IS NULL) OR (requested_vet_id = auth.uid())) AND public.is_verified_vet(auth.uid())) OR (farmer_id = auth.uid()) OR (farmer_email = (select public.request_identity()))))
  with check (((vet_id = auth.uid()) OR (vet_email = (select public.request_identity())) OR (((farmer_id = auth.uid()) OR (farmer_email = (select public.request_identity()))) AND (status = 'cancelled'::text))));

-- public.vet_farmer_messages
alter policy "participants can mark messages read" on public."vet_farmer_messages"
  using ((((select public.request_identity()) = vet_email) OR ((select public.request_identity()) = farmer_email)))
  with check ((((select public.request_identity()) = vet_email) OR ((select public.request_identity()) = farmer_email)));

alter policy "participants can read their conversation" on public."vet_farmer_messages"
  using (((((select public.request_identity()) = vet_email) OR ((select public.request_identity()) = farmer_email)) OR ((( SELECT auth.uid() AS uid) = vet_id) OR (( SELECT auth.uid() AS uid) = farmer_id))));

alter policy "participants can send messages" on public."vet_farmer_messages"
  with check (((sender_email = (select public.request_identity())) AND ((((select public.request_identity()) = vet_email) OR ((select public.request_identity()) = farmer_email)) OR ((( SELECT auth.uid() AS uid) = vet_id) OR (( SELECT auth.uid() AS uid) = farmer_id)))));

-- public.vet_medical_records
alter policy "farmers view their own medical records" on public."vet_medical_records"
  using (((( SELECT auth.uid() AS uid) = farmer_id) OR ((select public.request_identity()) = farmer_email)));

alter policy "vets manage their own medical records" on public."vet_medical_records"
  using (((( SELECT auth.uid() AS uid) = vet_id) OR ((select public.request_identity()) = vet_email)))
  with check (((( SELECT auth.uid() AS uid) = vet_id) OR ((select public.request_identity()) = vet_email)));

-- public.vet_questions
alter policy "owner_full_access" on public."vet_questions"
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

-- public.visit_records
alter policy "Farmers view their own visit records" on public."visit_records"
  using (((( SELECT auth.uid() AS uid) = farmer_id) OR ((select public.request_identity()) = farmer_email)));

alter policy "Vets manage their own visit records" on public."visit_records"
  using (((( SELECT auth.uid() AS uid) = vet_id) OR ((select public.request_identity()) = vet_email)))
  with check (((( SELECT auth.uid() AS uid) = vet_id) OR ((select public.request_identity()) = vet_email)));

-- public.wallets
alter policy "owner_read" on public."wallets"
  using ((user_email = (select public.request_identity())));

-- storage.objects
alter policy "vet and farmer can view their own lab result files" on storage."objects"
  using (((bucket_id = 'lab-results'::text) AND (EXISTS ( SELECT 1
   FROM public.vet_medical_records r
  WHERE ((r.file_path = objects.name) AND ((r.vet_id = ( SELECT auth.uid() AS uid)) OR (r.vet_email = (select public.request_identity())) OR (r.farmer_id = ( SELECT auth.uid() AS uid)) OR (r.farmer_email = (select public.request_identity()))))))));

