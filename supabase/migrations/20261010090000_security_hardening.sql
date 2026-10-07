-- Security hardening and tidy-up after a full review of the database
-- (Supabase advisor plus a rule-by-rule read, 2026-10).
--
-- Each weakness below was first reproduced against the live rules inside a
-- rolled-back transaction, then fixed here:
--
--   1. Someone not signed in could read verified vet profiles. The public
--      site never queries the database, so not-signed-in visitors now have
--      no access to any table, sequence or function.
--   2. Anonymous sign-ins are enabled on the project. An anonymous session
--      (no account) could read the community chat and supplier phone
--      numbers, inflate a supplier's contact counts and upload files.
--      Anonymous sessions are now refused everywhere, whatever that auth
--      setting says.
--   3. Any signed-in person could message another farmer posing as their
--      vet, and create a "completed" visit on someone else's record.
--   4. Vets could not decline a visit: the app saves "rejected", the
--      status rule only knew "declined".
--   5. A vet answering an emergency question could also rewrite the
--      question and who asked it.
--   6. Anyone signed in could upload into the private lab-results storage,
--      in any folder.
--   7. Phone sign-ups left blank profile rows behind, because the sign-up
--      trigger only looked at email.
--
-- It also removes eleven dead tables, makes existing rules say "signed-in
-- users" explicitly instead of the deprecated auth.role() check, wraps
-- auth calls so they run once per query, indexes foreign keys, and
-- describes every table.

-- ---------------------------------------------------------------------
-- 1. Dead tables
-- ---------------------------------------------------------------------
-- None is read or written by the app. All were empty except the two
-- community tables, whose 3 posts and 3 comments were copied into
-- community_chat (same ids) by 20261007090000_community_group_chat.
-- Columns are listed so any of them can be recreated if a later version
-- needs the idea again.
--   users(id, full_name, email, county, role, created_at)          never filled; auth.users + farmer_profiles are the real ones
--   chickens(id, user_id, batch_name, quantity, breed, age_in_days, created_at)   superseded by farm_batches
--   vaccinations(id, chicken_id, vaccine_name, due_date, completed, notes, created_at)   superseded by vaccination_tasks
--   bookings(id, user_email, vet_name, booking_date, status, created_at)          superseded by vet_appointments
--   messages(id, sender, message, created_at)                      old anonymous chat room
--   direct_messages(id, sender_email, sender_name, receiver_email, message, created_at)   never used
--   suppliers(id, name, category, county, contact, verified, created_at)          superseded by supplier_profiles
--   clucky_memory(id, user_email, farm_notes, disease_history, livestock_type, last_update)   superseded by clucky_messages
--   wallets(id, user_email, role, balance, created_at)             no payments exist; to be redesigned with them (version 2.1)
--   community_posts(id, user_email, user_name, user_avatar, content, image_url, likes, created_at)
--   community_comments(id, post_id, user_email, user_name, content, created_at)
drop function if exists public.increment_wallet(text, numeric);
drop table if exists public.vaccinations;
drop table if exists public.chickens;
drop table if exists public.users;
drop table if exists public.bookings, public.messages, public.direct_messages, public.suppliers,
                     public.clucky_memory, public.wallets;
drop table if exists public.community_comments, public.community_posts;

-- ---------------------------------------------------------------------
-- 2. Nothing for visitors who are not signed in
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;

-- and nothing by default for tables and functions created later
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres revoke execute on functions from public;

-- Functions only ever run by triggers need no caller at all.
revoke execute on function
  public.contact_events_prepare(), public.enforce_appointment_status_transition(),
  public.guard_supplier_verification_on_insert(), public.guard_vet_verification_on_insert(),
  public.handle_new_user(), public.prevent_self_verification(), public.products_sync_availability(),
  public.protect_farmer_verified(), public.protect_product_verified(),
  public.protect_supplier_verification_status(), public.rls_auto_enable(),
  public.notification_category(text)
  from authenticated;

-- What signed-in users (and server-side code) may still call.
grant execute on function
  public.is_app_admin(), public.request_identity(), public.is_verified_vet(uuid),
  public.admin_contact_stats(integer), public.supplier_contact_summary(integer),
  public.place_order(jsonb, text, text, text), public.community_remove_message(uuid),
  public.sync_my_reminders()
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. No anonymous sessions
-- ---------------------------------------------------------------------
-- An anonymous sign-in carries the same database role as a real account,
-- so "signed in" rules let it through. A restrictive rule on every table
-- says no first; ordinary rules then apply to real accounts as before.
create or replace function public.is_anonymous_session()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)
$$;

revoke all on function public.is_anonymous_session() from public, anon;
grant execute on function public.is_anonymous_session() to authenticated, service_role;

do $$
declare
  t record;
begin
  for t in select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' loop
    execute format('drop policy if exists block_anonymous_sessions on public.%I', t.relname);
    execute format(
      'create policy block_anonymous_sessions on public.%I as restrictive for all to authenticated '
      'using (not (select public.is_anonymous_session())) with check (not (select public.is_anonymous_session()))',
      t.relname);
  end loop;
end $$;

drop policy if exists block_anonymous_sessions on storage.objects;
create policy block_anonymous_sessions on storage.objects
  as restrictive for all to authenticated
  using (not (select public.is_anonymous_session()))
  with check (not (select public.is_anonymous_session()));

-- ---------------------------------------------------------------------
-- 4. Existing rules, tidied (generated from the live definitions)
-- ---------------------------------------------------------------------
-- Same logic as before. Rules that applied to every role now name
-- signed-in users; auth.role() checks (deprecated, and true for anonymous
-- sessions) are gone; auth.uid() is wrapped so it runs once per query;
-- admin checks use is_app_admin().

alter policy "batch_expenses_delete_own" on public.batch_expenses
  to authenticated
  using (((select auth.uid()) = user_id));

alter policy "batch_expenses_insert_own" on public.batch_expenses
  to authenticated
  with check (((select auth.uid()) = user_id));

alter policy "batch_expenses_select_own" on public.batch_expenses
  to authenticated
  using (((select auth.uid()) = user_id));

alter policy "batch_expenses_update_own" on public.batch_expenses
  to authenticated
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));

alter policy "batch_sales_delete_own" on public.batch_sales
  to authenticated
  using (((select auth.uid()) = user_id));

alter policy "batch_sales_insert_own" on public.batch_sales
  to authenticated
  with check (((select auth.uid()) = user_id));

alter policy "batch_sales_select_own" on public.batch_sales
  to authenticated
  using (((select auth.uid()) = user_id));

alter policy "batch_sales_update_own" on public.batch_sales
  to authenticated
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));

alter policy "everyone_read" on public.community_chat
  to authenticated
  using (true);

alter policy "owner_full_access" on public.farm_batches
  to authenticated
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

alter policy "admin can view all farm batches" on public.farm_batches
  using (((select public.is_app_admin())));

alter policy "owner_full_access" on public.farm_finances
  to authenticated
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

alter policy "owner_full_access" on public.farm_gallery
  to authenticated
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

alter policy "owner_full_access" on public.farm_tasks
  to authenticated
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

alter policy "owner_full_access" on public.farmer_profiles
  to authenticated
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

alter policy "admin can view all farmer profiles" on public.farmer_profiles
  using (((select public.is_app_admin())));

alter policy "verified vets can view farmer profiles" on public.farmer_profiles
  to authenticated
  using (public.is_verified_vet((select auth.uid())));

alter policy "vets can view farmers they have appointments with" on public.farmer_profiles
  to authenticated
  using ((EXISTS ( SELECT 1 FROM public.vet_appointments a WHERE ((a.farmer_email = farmer_profiles.user_email) AND ((a.vet_id = (select auth.uid())) OR (a.vet_email = (select public.request_identity())))))));

alter policy "owner_full_access" on public.feed_calculations
  to authenticated
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

alter policy "owner_write" on public.message_reactions
  to authenticated
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

alter policy "everyone_read" on public.message_reactions
  to authenticated
  using (true);

alter policy "owner_full_access" on public.mortality_logs
  to authenticated
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

alter policy "owner_full_access" on public.notifications
  to authenticated
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

alter policy "orders_supplier_select_own" on public.orders
  to authenticated
  using (((supplier_id IS NOT NULL) AND (supplier_id IN ( SELECT supplier_profiles.id FROM public.supplier_profiles WHERE (supplier_profiles.user_id = (select auth.uid()))))));

alter policy "orders_supplier_update_delivery_status" on public.orders
  to authenticated
  using ((supplier_id IN ( SELECT supplier_profiles.id FROM public.supplier_profiles WHERE (supplier_profiles.user_id = (select auth.uid())))))
  with check ((supplier_id IN ( SELECT supplier_profiles.id FROM public.supplier_profiles WHERE (supplier_profiles.user_id = (select auth.uid())))));

alter policy "owner_write" on public.products
  to authenticated
  using ((user_email = (select public.request_identity())))
  with check (((user_email = (select public.request_identity())) AND ((supplier_id IS NULL) OR (supplier_id IN ( SELECT sp.id FROM public.supplier_profiles sp WHERE (sp.user_id = (select auth.uid())))))));

alter policy "products_supplier_insert_own" on public.products
  to authenticated
  with check (((supplier_id IN ( SELECT sp.id FROM public.supplier_profiles sp WHERE (sp.user_id = (select auth.uid())))) AND (user_email = (select public.request_identity()))));

alter policy "everyone_read" on public.products
  to authenticated
  using ((is_active OR (user_email = (select public.request_identity())) OR (supplier_id IN ( SELECT sp.id FROM public.supplier_profiles sp WHERE (sp.user_id = (select auth.uid())))) OR (select public.is_app_admin())));

alter policy "products_supplier_manage_own" on public.products
  to authenticated
  using (((supplier_id IS NOT NULL) AND (supplier_id IN ( SELECT supplier_profiles.id FROM public.supplier_profiles WHERE (supplier_profiles.user_id = (select auth.uid()))))))
  with check ((supplier_id IN ( SELECT supplier_profiles.id FROM public.supplier_profiles WHERE (supplier_profiles.user_id = (select auth.uid())))));

alter policy "supplier_profiles_insert_own" on public.supplier_profiles
  to authenticated
  with check (((select auth.uid()) = user_id));

alter policy "supplier_profiles_select_own" on public.supplier_profiles
  to authenticated
  using (((select auth.uid()) = user_id));

alter policy "supplier_profiles_update_own" on public.supplier_profiles
  to authenticated
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));

alter policy "owner_full_access" on public.vaccination_tasks
  to authenticated
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

alter policy "appointment select rules" on public.vet_appointments
  to authenticated
  using (((farmer_id = (select auth.uid())) OR (farmer_email = (select public.request_identity())) OR (vet_id = (select auth.uid())) OR (vet_email = (select public.request_identity())) OR ((vet_id IS NULL) AND (status = 'pending'::text) AND ((requested_vet_id IS NULL) OR (requested_vet_id = (select auth.uid()))) AND public.is_verified_vet((select auth.uid())))));

alter policy "appointment update rules" on public.vet_appointments
  to authenticated
  using (((vet_id = (select auth.uid())) OR (vet_email = (select public.request_identity())) OR ((vet_id IS NULL) AND (status = 'pending'::text) AND ((requested_vet_id IS NULL) OR (requested_vet_id = (select auth.uid()))) AND public.is_verified_vet((select auth.uid()))) OR (farmer_id = (select auth.uid())) OR (farmer_email = (select public.request_identity()))))
  with check (((vet_id = (select auth.uid())) OR (vet_email = (select public.request_identity())) OR (((farmer_id = (select auth.uid())) OR (farmer_email = (select public.request_identity()))) AND (status = 'cancelled'::text))));

alter policy "Vets manage their own blocked dates" on public.vet_blocked_dates
  to authenticated
  using (((select auth.uid()) = vet_id))
  with check (((select auth.uid()) = vet_id));

alter policy "participants can read their conversation" on public.vet_farmer_messages
  to authenticated
  using ((((select public.request_identity()) = vet_email) OR ((select public.request_identity()) = farmer_email) OR (((select auth.uid()) = vet_id) OR ((select auth.uid()) = farmer_id))));

alter policy "participants can mark messages read" on public.vet_farmer_messages
  to authenticated
  using ((((select public.request_identity()) = vet_email) OR ((select public.request_identity()) = farmer_email)))
  with check ((((select public.request_identity()) = vet_email) OR ((select public.request_identity()) = farmer_email)));

alter policy "vets manage their own medical records" on public.vet_medical_records
  to authenticated
  using ((((select auth.uid()) = vet_id) OR ((select public.request_identity()) = vet_email)))
  with check ((((select auth.uid()) = vet_id) OR ((select public.request_identity()) = vet_email)));

alter policy "farmers view their own medical records" on public.vet_medical_records
  to authenticated
  using ((((select auth.uid()) = farmer_id) OR ((select public.request_identity()) = farmer_email)));

alter policy "vet manages own profile" on public.vet_profiles
  to authenticated
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));

alter policy "admin can view all vet profiles" on public.vet_profiles
  using (((select public.is_app_admin())));

alter policy "anyone can view verified vets" on public.vet_profiles
  to authenticated
  using ((verification_status = 'verified'::text));

alter policy "admin can update vet verification" on public.vet_profiles
  using (((select public.is_app_admin())))
  with check (((select public.is_app_admin())));

alter policy "owner_full_access" on public.vet_questions
  to authenticated
  using ((user_email = (select public.request_identity())))
  with check ((user_email = (select public.request_identity())));

alter policy "verified vets can view emergency questions" on public.vet_questions
  to authenticated
  using (((is_emergency = true) AND public.is_verified_vet((select auth.uid()))));

alter policy "verified vets can respond to emergency questions" on public.vet_questions
  to authenticated
  using (((is_emergency = true) AND public.is_verified_vet((select auth.uid()))))
  with check (((is_emergency = true) AND public.is_verified_vet((select auth.uid()))));

alter policy "Vets manage their own visit records" on public.visit_records
  to authenticated
  using ((((select auth.uid()) = vet_id) OR ((select public.request_identity()) = vet_email)))
  with check ((((select auth.uid()) = vet_id) OR ((select public.request_identity()) = vet_email)));

alter policy "Farmers view their own visit records" on public.visit_records
  to authenticated
  using ((((select auth.uid()) = farmer_id) OR ((select public.request_identity()) = farmer_email)));

alter policy "Users can delete own community images" on storage.objects
  to authenticated
  using (((bucket_id = 'community-posts'::text) AND (((select auth.uid()))::text = (storage.foldername(name))[1])));

alter policy "vet and farmer can view their own lab result files" on storage.objects
  to authenticated
  using (((bucket_id = 'lab-results'::text) AND (EXISTS ( SELECT 1 FROM public.vet_medical_records r WHERE ((r.file_path = objects.name) AND ((r.vet_id = (select auth.uid())) OR (r.vet_email = (select public.request_identity())) OR (r.farmer_id = (select auth.uid())) OR (r.farmer_email = (select public.request_identity()))))))));

-- ---------------------------------------------------------------------
-- 5. Vets and farmers: who may message whom, and who may book what
-- ---------------------------------------------------------------------
-- True when the account id or identity given belongs to a verified vet.
-- Farmers address a vet by email, so the id alone is not enough.
create or replace function public.is_verified_vet_identity(p_vet_id uuid, p_vet_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vet_profiles v
     where v.verification_status = 'verified'
       and (v.user_id = p_vet_id
            or (coalesce(p_vet_email, '') <> ''
                and (v.email = p_vet_email or public.identity_of_user(v.user_id) = p_vet_email))))
$$;

revoke all on function public.is_verified_vet_identity(uuid, text) from public, anon;
grant execute on function public.is_verified_vet_identity(uuid, text) to authenticated, service_role;

alter function public.is_verified_vet(uuid) set search_path = '';

-- True when the caller is a verified vet who has a visit with this farmer,
-- or whom this farmer has already written to. A function, not a subquery in
-- the rule, because a rule on vet_farmer_messages cannot read that table
-- itself (Postgres refuses it as circular).
create or replace function public.vet_may_message_farmer(p_farmer_email text, p_farmer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_verified_vet((select auth.uid()))
     and (
       exists (select 1 from public.vet_appointments a
                where (a.vet_id = (select auth.uid()) or a.vet_email = (select public.request_identity()))
                  and (a.farmer_email = p_farmer_email or (a.farmer_id is not null and a.farmer_id = p_farmer_id)))
       or exists (select 1 from public.vet_farmer_messages m
                   where m.vet_email = (select public.request_identity())
                     and m.farmer_email = p_farmer_email
                     and m.sender_email = m.farmer_email)
     )
$$;

revoke all on function public.vet_may_message_farmer(text, uuid) from public, anon;
grant execute on function public.vet_may_message_farmer(text, uuid) to authenticated, service_role;

-- Messages: the old rule let any signed-in person start a "vet"
-- conversation with any farmer.
drop policy if exists "participants can send messages" on public.vet_farmer_messages;
create policy vet_farmer_messages_send on public.vet_farmer_messages
  for insert to authenticated
  with check (
    sender_email = (select public.request_identity())
    and (
      -- a farmer writing to a verified vet
      ((farmer_email = (select public.request_identity()) or farmer_id = (select auth.uid()))
        and public.is_verified_vet_identity(vet_id, vet_email))
      or
      -- a verified vet writing to a farmer they have a visit with, or who wrote first
      ((vet_email = (select public.request_identity()) or vet_id = (select auth.uid()))
        and public.vet_may_message_farmer(farmer_email, farmer_id))
    )
  );

alter policy "participants can read their conversation" on public.vet_farmer_messages to authenticated;
alter policy "participants can mark messages read" on public.vet_farmer_messages to authenticated;

-- Visits: the old rule let anyone insert a visit naming themselves as the
-- vet, in any status, on any farmer.
drop policy if exists "appointment insert rules" on public.vet_appointments;
create policy vet_appointments_insert on public.vet_appointments
  for insert to authenticated
  with check (
    -- a farmer asking for a visit: their own request, not yet assigned or priced
    ((farmer_id = (select auth.uid()) or farmer_email = (select public.request_identity()))
      and (farmer_id is null or farmer_id = (select auth.uid()))
      and (farmer_email is null or farmer_email = (select public.request_identity()))
      and status = 'pending' and vet_id is null and vet_email is null and coalesce(fee, 0) = 0)
    or
    -- a verified vet scheduling a visit themselves
    ((vet_id = (select auth.uid()) or vet_email = (select public.request_identity()))
      and (vet_id is null or vet_id = (select auth.uid()))
      and (vet_email is null or vet_email = (select public.request_identity()))
      and public.is_verified_vet((select auth.uid()))
      and status in ('pending', 'accepted'))
  );

-- Declining a visit never worked: the app saves "rejected", but both the
-- status check on the table and the transition rule only knew "declined",
-- so the vet got an error every time. Both now accept either spelling.
alter table public.vet_appointments drop constraint if exists vet_appointments_status_check;
alter table public.vet_appointments add constraint vet_appointments_status_check
  check (status in ('pending', 'accepted', 'rejected', 'declined', 'completed', 'cancelled'));

-- Declining a visit. The app saves "rejected"; "declined" is kept as an
-- accepted spelling in case older rows or code use it. The moves allowed
-- match STATUS_TRANSITIONS in src/pages/Appointments.jsx.
create or replace function public.enforce_appointment_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status is not distinct from new.status then
    return new;
  end if;
  if old.status in ('completed', 'cancelled', 'rejected', 'declined') then
    raise exception 'Cannot change status from terminal state (%).', old.status;
  end if;
  if old.status = 'pending' and new.status not in ('accepted', 'rejected', 'declined', 'cancelled', 'completed') then
    raise exception 'Invalid transition from pending to %.', new.status;
  end if;
  if old.status = 'accepted' and new.status not in ('completed', 'cancelled') then
    raise exception 'Invalid transition from accepted to %.', new.status;
  end if;
  return new;
end;
$$;

-- Emergency questions: a vet may answer (status, answer, severity,
-- assigned vet, escalation), not rewrite what was asked or by whom.
create or replace function public.protect_vet_question_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or (select public.is_app_admin())
     or old.user_email = (select public.request_identity()) then
    return new;
  end if;
  new.user_email := old.user_email;
  new.farmer_id := old.farmer_id;
  new.question := old.question;
  new.category := old.category;
  new.image_url := old.image_url;
  new.is_emergency := old.is_emergency;
  new.created_at := old.created_at;
  return new;
end;
$$;

revoke all on function public.protect_vet_question_fields() from public, anon, authenticated;

drop trigger if exists trg_protect_vet_question_fields on public.vet_questions;
create trigger trg_protect_vet_question_fields
  before update on public.vet_questions
  for each row execute function public.protect_vet_question_fields();

alter function public.prevent_self_verification() set search_path = '';

-- ---------------------------------------------------------------------
-- 6. Storage
-- ---------------------------------------------------------------------
-- Lab results: verified vets only, and only into their own folder (which
-- is where the app puts them).
drop policy if exists "vets can upload lab result files" on storage.objects;
create policy "verified vets upload lab results to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'lab-results'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_verified_vet((select auth.uid()))
  );

-- an exact duplicate of "Anyone can view farm gallery images"
drop policy if exists "Anyone can view farm gallery" on storage.objects;

-- ---------------------------------------------------------------------
-- 7. Sign-up profile trigger
-- ---------------------------------------------------------------------
-- It used new.email only, so every phone sign-up produced a profile row
-- with no identity that nobody could ever read. It now uses the account's
-- identity (email, or phone), takes the name Google provides when there is
-- one, and can never block a sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ident text := coalesce(nullif(new.email, ''), nullif(new.phone, ''));
begin
  if ident is null then
    return new;
  end if;
  begin
    insert into public.farmer_profiles (user_email, full_name, country_code)
    values (
      ident,
      coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
               nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
               'Farmer'),
      '+254')
    on conflict (user_email) do nothing;
  exception when others then
    raise warning 'handle_new_user: no profile created for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

delete from public.farmer_profiles where coalesce(btrim(user_email), '') = '';

alter table public.farmer_profiles
  alter column user_email set not null,
  add constraint farmer_profiles_user_email_present check (btrim(user_email) <> '');

-- two identical unique constraints on the same column
alter table public.farmer_profiles drop constraint if exists farmer_profiles_user_email_unique;

-- ---------------------------------------------------------------------
-- 8. Indexes for foreign keys that had none
-- ---------------------------------------------------------------------
create index if not exists contact_events_product_id_idx on public.contact_events (product_id);
create index if not exists contact_events_contacted_by_idx on public.contact_events (contacted_by);
create index if not exists farm_gallery_batch_id_idx on public.farm_gallery (batch_id);
create index if not exists orders_product_id_idx on public.orders (product_id);
create index if not exists vaccination_tasks_batch_id_idx on public.vaccination_tasks (batch_id);
create index if not exists vet_appointments_farmer_id_idx on public.vet_appointments (farmer_id);
create index if not exists vet_appointments_requested_vet_id_idx on public.vet_appointments (requested_vet_id);
create index if not exists vet_medical_records_appointment_id_idx on public.vet_medical_records (appointment_id);
create index if not exists vet_questions_escalated_appointment_id_idx on public.vet_questions (escalated_appointment_id);
create index if not exists vet_questions_farmer_id_idx on public.vet_questions (farmer_id);

-- ---------------------------------------------------------------------
-- 9. What each table is for (shown in the Supabase dashboard)
-- ---------------------------------------------------------------------
comment on table public.farmer_profiles is 'One row per account (every role): name, county, photo, notification master switch, onboarding flag. Keyed by identity (email, or phone).';
comment on table public.farm_batches is 'A farmer''s flocks: type, hatch date, counts, status.';
comment on table public.vaccination_tasks is 'The vaccination schedule generated for each batch.';
comment on table public.mortality_logs is 'Bird deaths recorded against a batch.';
comment on table public.batch_expenses is 'Money spent on a batch.';
comment on table public.batch_sales is 'Sales recorded for a batch.';
comment on table public.farm_finances is 'General farm income and expense entries (Finance page).';
comment on table public.farm_tasks is 'A farmer''s to-do list.';
comment on table public.farm_gallery is 'Farm photos; files live in the farm-gallery storage bucket.';
comment on table public.feed_calculations is 'Saved feed plans from the Feed Calculator.';
comment on table public.vet_profiles is 'Vets: services, fee, availability and verification status (set by an admin).';
comment on table public.vet_blocked_dates is 'Days a vet is unavailable for visits.';
comment on table public.vet_questions is 'Questions farmers ask vets, including emergencies, and the answers.';
comment on table public.vet_appointments is 'Farm visit requests between farmers and vets, and their status.';
comment on table public.visit_records is 'A vet''s clinical notes for a completed visit.';
comment on table public.vet_medical_records is 'Medical records and prescriptions a vet keeps for a farmer; files live in the private lab-results bucket.';
comment on table public.vet_farmer_messages is 'Private messages between a farmer and a vet.';
comment on table public.supplier_profiles is 'Suppliers: business details, contact numbers and verification status (set by an admin).';
comment on table public.products is 'Marketplace listings.';
comment on table public.contact_events is 'A farmer tapped Call or WhatsApp on a supplier or product. Insert-only; suppliers see counts, never who.';
comment on table public.orders is 'In-app orders. Unused while IN_APP_ORDERING is off in the app.';
comment on table public.community_chat is 'The community group chat. Members insert only; the insert guard sets name, badge and reply preview.';
comment on table public.message_reactions is 'One reaction per person per community message.';
comment on table public.community_reports is 'Members'' reports of community messages, for admins to review.';
comment on table public.notifications is 'Each person''s in-app notifications, created by database triggers and sync_my_reminders().';
