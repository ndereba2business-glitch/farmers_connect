-- Account deletion, reporting and blocking, and recorded consent.
--
-- Why. Before this migration:
--   * "Delete Account" removed rows from three tables and signed the person
--     out. The login, and almost everything they had written, stayed.
--   * A marketplace listing or a Clucky answer could not be reported, and a
--     member could not block another member.
--   * Nothing recorded that a person had agreed to the terms, or had been
--     told that Clucky sends their question to an outside AI service.
--
-- What this adds:
--   1. farmer_profiles: when the terms were accepted, and when the person
--      agreed to Clucky's AI processing.
--   2. user_blocks: who a person has chosen not to see.
--   3. content_reports: reports about listings, Clucky answers and members
--      (community messages keep their own community_reports table).
--   4. account_requests: deletion and privacy requests sent from the public
--      web page by people who cannot sign in. Written only by an edge
--      function; read and resolved by admins.
--   5. account_deletions: a log that a deletion happened, with counts and
--      no identity.
--   6. delete_account_data(): removes everything an account owns, in one
--      transaction. Only the delete-account edge function may call it.

-- ---------------------------------------------------------------------
-- 1. Consent, recorded on the profile every account already has
-- ---------------------------------------------------------------------
alter table public.farmer_profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text
    check (terms_version is null or char_length(terms_version) <= 20),
  add column if not exists clucky_consent_at timestamptz;

comment on column public.farmer_profiles.terms_accepted_at is
  'When this person accepted the Terms and Community Rules and was shown the Privacy Policy. Null until they do; they cannot post or list before that.';
comment on column public.farmer_profiles.clucky_consent_at is
  'When this person agreed that Clucky sends their question and a short farm summary to the AI service. The clucky edge function refuses to answer while it is null.';

-- ---------------------------------------------------------------------
-- 2. Blocking another member
-- ---------------------------------------------------------------------
create table if not exists public.user_blocks (
  blocker text not null default public.request_identity(),
  blocked text not null check (char_length(btrim(blocked)) between 3 and 320),
  -- the name the blocker saw, so their list of blocked members can show it
  blocked_name text check (blocked_name is null or char_length(blocked_name) <= 60),
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  constraint user_blocks_not_self check (blocker <> blocked)
);
comment on table public.user_blocks is
  'Members a person has blocked. Both columns are account identities (email, or phone for phone accounts). The app hides the blocked member''s community messages and listings from the blocker; the blocked member is not told.';

alter table public.user_blocks enable row level security;

create policy block_anonymous_sessions on public.user_blocks
  as restrictive for all to authenticated
  using (not (select public.is_anonymous_session()))
  with check (not (select public.is_anonymous_session()));

create policy user_blocks_read_own on public.user_blocks
  for select to authenticated using (blocker = (select public.request_identity()));
create policy user_blocks_insert_own on public.user_blocks
  for insert to authenticated with check (blocker = (select public.request_identity()));
create policy user_blocks_delete_own on public.user_blocks
  for delete to authenticated using (blocker = (select public.request_identity()));

revoke all on public.user_blocks from anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;

-- ---------------------------------------------------------------------
-- 3. Reports about listings, Clucky answers and members
-- ---------------------------------------------------------------------
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('listing', 'clucky_answer', 'member')),
  -- the product id, the clucky_messages id, or the member's identity
  target_id text not null check (char_length(target_id) between 1 and 320),
  -- what was reported, as the reporter saw it, in case it changes or goes
  target_summary text check (target_summary is null or char_length(target_summary) <= 600),
  reporter text not null default public.request_identity(),
  reason text not null check (char_length(btrim(reason)) between 1 and 300),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text,
  constraint content_reports_once unique (kind, target_id, reporter)
);
comment on table public.content_reports is
  'Reports from signed-in people about a marketplace listing, a Clucky answer or another member. Reporter and resolved_by are account identities. Admins review them; a reporter can see only their own.';

create index if not exists content_reports_open_idx on public.content_reports (created_at desc) where status = 'open';

alter table public.content_reports enable row level security;

create policy block_anonymous_sessions on public.content_reports
  as restrictive for all to authenticated
  using (not (select public.is_anonymous_session()))
  with check (not (select public.is_anonymous_session()));

create policy content_reports_insert_own on public.content_reports
  for insert to authenticated
  with check (reporter = (select public.request_identity()) and status = 'open' and resolved_at is null and resolved_by is null);
create policy content_reports_read_own_or_admin on public.content_reports
  for select to authenticated
  using (reporter = (select public.request_identity()) or (select public.is_app_admin()));
create policy content_reports_admin_update on public.content_reports
  for update to authenticated
  using ((select public.is_app_admin())) with check ((select public.is_app_admin()));

revoke all on public.content_reports from anon, authenticated;
grant select, insert, update on public.content_reports to authenticated;

-- ---------------------------------------------------------------------
-- 4. Requests from the public web page (people who cannot sign in)
-- ---------------------------------------------------------------------
create table if not exists public.account_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('delete_account', 'privacy')),
  -- the email or phone number the person says the account uses
  identity text not null check (char_length(btrim(identity)) between 3 and 320),
  message text check (message is null or char_length(message) <= 1000),
  status text not null default 'open' check (status in ('open', 'done', 'rejected')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);
comment on table public.account_requests is
  'Account deletion and privacy requests submitted from the public /delete-account page by people who cannot sign in. Rows are written only by the account-request edge function (service role). An admin must confirm the person owns the account before acting. Resolved requests should be deleted after 90 days.';

create index if not exists account_requests_open_idx on public.account_requests (created_at desc) where status = 'open';
create index if not exists account_requests_identity_idx on public.account_requests (identity, created_at desc);

alter table public.account_requests enable row level security;

create policy block_anonymous_sessions on public.account_requests
  as restrictive for all to authenticated
  using (not (select public.is_anonymous_session()))
  with check (not (select public.is_anonymous_session()));

create policy account_requests_admin_read on public.account_requests
  for select to authenticated using ((select public.is_app_admin()));
create policy account_requests_admin_update on public.account_requests
  for update to authenticated
  using ((select public.is_app_admin())) with check ((select public.is_app_admin()));
create policy account_requests_admin_delete on public.account_requests
  for delete to authenticated using ((select public.is_app_admin()));

revoke all on public.account_requests from anon, authenticated;
grant select, update, delete on public.account_requests to authenticated;

-- ---------------------------------------------------------------------
-- 5. Proof that deletions happen, without keeping who it was
-- ---------------------------------------------------------------------
create table if not exists public.account_deletions (
  id uuid primary key default gen_random_uuid(),
  deleted_at timestamptz not null default now(),
  method text not null check (method in ('self', 'admin')),
  account_role text,
  rows_removed jsonb not null default '{}'::jsonb,
  -- storage paths that could not be removed and still need cleaning up
  files_left jsonb not null default '[]'::jsonb
);
comment on table public.account_deletions is
  'One row per completed account deletion: when, how, the role, and how many rows went from each table. Holds no name, email, phone number or user id. Written only by the delete-account edge function.';

alter table public.account_deletions enable row level security;

create policy block_anonymous_sessions on public.account_deletions
  as restrictive for all to authenticated
  using (not (select public.is_anonymous_session()))
  with check (not (select public.is_anonymous_session()));

create policy account_deletions_admin_read on public.account_deletions
  for select to authenticated using ((select public.is_app_admin()));

revoke all on public.account_deletions from anon, authenticated;
grant select on public.account_deletions to authenticated;

-- ---------------------------------------------------------------------
-- 6. Removing everything an account owns
-- ---------------------------------------------------------------------
-- Rows in this database are owned in two ways: by the auth user id, and
-- (most of the older tables) by the account identity, the email or the
-- phone number. Deleting the login alone therefore leaves most of a
-- person's data behind, and a later sign-up with the same email would
-- inherit it. This function removes both kinds, in one transaction.
--
-- What is kept, and why (also stated in the privacy policy):
--   * A visit report, prescription or lab result a vet wrote for a farmer
--     stays in THE FARMER'S records when the VET leaves: it is the
--     farmer's flock-health history. The vet's id and email are removed
--     from it. When the farmer leaves, those records are deleted.
--   * An answer a vet gave to a farmer's question stays with the farmer's
--     question; the link to the vet is removed.
--   * Orders another person placed with a departing supplier keep the
--     product name and amounts; the link to the supplier is removed.
--     (In-app ordering is switched off, so there are none today.)
--   * Counts of contacts made by OTHER farmers are not personal to the
--     departing account and go with its supplier profile or listings.
--
-- Returns the public file URLs and private file paths the caller must
-- remove from storage, and the row counts for the deletion log.
create or replace function public.delete_account_data(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ident text;
  supplier_ids uuid[];
  product_ids uuid[];
  message_ids uuid[];
  batch_ids uuid[];
  files text[] := '{}';
  private_files text[] := '{}';
  counts jsonb := '{}'::jsonb;
  n bigint;
begin
  select coalesce(nullif(u.email, ''), nullif(u.phone, '')) into ident
    from auth.users u where u.id = p_user_id;
  if not found then
    raise exception 'account not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from auth.users u where u.id = p_user_id and u.raw_app_meta_data ->> 'role' = 'admin') then
    raise exception 'admin accounts are removed by the project owner' using errcode = '42501';
  end if;

  -- ----- files to remove afterwards (collected before the rows go) -----
  select coalesce(array_agg(u), '{}') into files from (
    select avatar_url as u from public.farmer_profiles where user_email = ident and coalesce(avatar_url, '') <> ''
    union select image_url from public.farm_gallery where user_email = ident and coalesce(image_url, '') <> ''
    union select image_url from public.community_chat where user_email = ident and coalesce(image_url, '') <> ''
    union select image_url from public.vet_questions where (user_email = ident or farmer_id = p_user_id) and coalesce(image_url, '') <> ''
    union select photo_url from public.vet_profiles where user_id = p_user_id and coalesce(photo_url, '') <> ''
    union select logo_url from public.supplier_profiles where user_id = p_user_id and coalesce(logo_url, '') <> ''
    union select p.image_url from public.products p
      where (p.user_email = ident or p.supplier_id in (select s.id from public.supplier_profiles s where s.user_id = p_user_id))
        and coalesce(p.image_url, '') <> ''
  ) x;
  -- lab results written FOR this person as a farmer go with them
  select coalesce(array_agg(file_path), '{}') into private_files
    from public.vet_medical_records
   where (farmer_id = p_user_id or (ident is not null and farmer_email = ident)) and coalesce(file_path, '') <> '';

  -- ----- Clucky, notifications -----
  delete from public.clucky_messages where user_email = ident;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('clucky_messages', n);
  delete from public.clucky_usage where user_id = p_user_id;
  delete from public.notifications where user_email = ident;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('notifications', n);
  delete from public.notification_preferences where user_email = ident;

  -- ----- community -----
  select coalesce(array_agg(id), '{}') into message_ids from public.community_chat where user_email = ident;
  -- what other members quoted from this person's messages
  update public.community_chat
     set reply_to_user = 'Former member', reply_to_message = null
   where reply_to_id = any (message_ids);
  delete from public.message_reactions where user_email = ident;
  delete from public.community_reports where reporter = ident;
  delete from public.community_chat where id = any (message_ids);   -- reactions and reports on them cascade
  get diagnostics n = row_count; counts := counts || jsonb_build_object('community_messages', n);
  delete from public.community_mutes where user_email = ident;
  delete from public.user_blocks where blocker = ident or blocked = ident;
  delete from public.content_reports
   where reporter = ident or (kind = 'member' and target_id = ident);

  -- ----- farm records -----
  select coalesce(array_agg(id), '{}') into batch_ids from public.farm_batches where user_email = ident;
  delete from public.vaccination_tasks where user_email = ident or batch_id = any (batch_ids);
  delete from public.mortality_logs where user_email = ident or batch_id = any (batch_ids);
  delete from public.batch_expenses where user_id = p_user_id or batch_id = any (batch_ids);
  delete from public.batch_sales where user_id = p_user_id or batch_id = any (batch_ids);
  delete from public.farm_gallery where user_email = ident or batch_id = any (batch_ids);
  get diagnostics n = row_count; counts := counts || jsonb_build_object('gallery_photos', n);
  delete from public.feed_calculations where user_email = ident;
  delete from public.farm_batches where id = any (batch_ids);
  get diagnostics n = row_count; counts := counts || jsonb_build_object('batches', n);
  delete from public.farm_tasks where user_email = ident;
  delete from public.farm_finances where user_email = ident;

  -- ----- marketplace -----
  select coalesce(array_agg(id), '{}') into supplier_ids from public.supplier_profiles where user_id = p_user_id;
  select coalesce(array_agg(id), '{}') into product_ids from public.products
   where user_email = ident or supplier_id = any (supplier_ids);
  delete from public.content_reports where kind = 'listing' and target_id = any (select unnest(product_ids)::text);
  delete from public.contact_events
   where contacted_by = p_user_id or supplier_id = any (supplier_ids) or product_id = any (product_ids);
  -- orders this person placed carry their name and phone number
  delete from public.orders where buyer_id = p_user_id;
  -- orders other people placed with them keep the item and amounts only
  update public.orders set supplier_id = null where supplier_id = any (supplier_ids);
  delete from public.products where id = any (product_ids);
  get diagnostics n = row_count; counts := counts || jsonb_build_object('listings', n);
  delete from public.supplier_profiles where id = any (supplier_ids);
  get diagnostics n = row_count; counts := counts || jsonb_build_object('supplier_profiles', n);

  -- ----- vet services: this person as a FARMER -----
  delete from public.vet_farmer_messages
   where farmer_id = p_user_id or farmer_email = ident or vet_id = p_user_id or vet_email = ident or sender_email = ident;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('vet_messages', n);
  delete from public.vet_medical_records where farmer_id = p_user_id or farmer_email = ident;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('medical_records', n);
  delete from public.visit_records where farmer_id = p_user_id or farmer_email = ident;
  delete from public.vet_questions where user_email = ident or farmer_id = p_user_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('vet_questions', n);
  -- a question that became one of this farmer's bookings lets go of it first
  update public.vet_questions set escalated_appointment_id = null
   where escalated_appointment_id in (select a.id from public.vet_appointments a where a.farmer_id = p_user_id or a.farmer_email = ident);
  delete from public.vet_appointments where farmer_id = p_user_id or farmer_email = ident;   -- visit records cascade
  get diagnostics n = row_count; counts := counts || jsonb_build_object('appointments', n);

  -- ----- vet services: this person as a VET -----
  -- bookings that never happened are removed; the farmer is told
  perform public.push_notification(
    a.farmer_email, 'appointment', 'A vet booking was cancelled',
    'The vet you booked for ' || to_char(a.appointment_date, 'DD Mon') || ' is no longer on Farmers Connect. Please book another vet in Ask Vet.',
    '/bookings', 'vet-left:' || a.id)
    from public.vet_appointments a
   where (a.vet_id = p_user_id or a.vet_email = ident or a.requested_vet_id = p_user_id)
     and a.status in ('pending', 'accepted') and a.farmer_email is not null;
  update public.vet_questions set escalated_appointment_id = null
   where escalated_appointment_id in (
     select a.id from public.vet_appointments a
      where (a.vet_id = p_user_id or a.vet_email = ident or a.requested_vet_id = p_user_id) and a.status in ('pending', 'accepted'));
  delete from public.vet_appointments a
   where (a.vet_id = p_user_id or a.vet_email = ident or a.requested_vet_id = p_user_id) and a.status in ('pending', 'accepted');
  -- finished visits stay in the farmer's history, without the vet's identity
  update public.vet_appointments
     set vet_id = case when vet_id = p_user_id then null else vet_id end,
         requested_vet_id = case when requested_vet_id = p_user_id then null else requested_vet_id end,
         vet_email = case when vet_email = ident then null else vet_email end
   where vet_id = p_user_id or requested_vet_id = p_user_id or vet_email = ident;
  update public.visit_records set vet_id = null, vet_email = null where vet_id = p_user_id or vet_email = ident;
  update public.vet_medical_records set vet_id = null, vet_email = null where vet_id = p_user_id or vet_email = ident;
  update public.vet_questions set assigned_vet = null where assigned_vet = ident;
  delete from public.vet_blocked_dates where vet_id = p_user_id;
  delete from public.vet_profiles where user_id = p_user_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('vet_profiles', n);

  -- ----- the profile itself, last -----
  delete from public.farmer_profiles where user_email = ident;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('profiles', n);

  -- requests this person sent from the web page are settled by the deletion
  update public.account_requests
     set status = 'done', resolved_at = now(), resolved_by = 'account deleted', identity = 'deleted account', message = null
   where identity = ident;

  return jsonb_build_object('files', to_jsonb(files), 'private_files', to_jsonb(private_files), 'counts', counts);
end;
$$;

revoke all on function public.delete_account_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_account_data(uuid) to service_role;

comment on function public.delete_account_data(uuid) is
  'Deletes everything an account owns and returns the storage files to remove. Called only by the delete-account edge function, which then deletes the files and the login itself.';

-- An admin acting on a request from the web page knows the email or phone
-- number, not the user id. Service role only: it would otherwise tell
-- anyone whether an address has an account.
create or replace function public.account_for_identity(p_identity text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from auth.users u
   where btrim(coalesce(p_identity, '')) <> ''
     and (lower(u.email) = lower(btrim(p_identity))
          or u.phone = regexp_replace(btrim(p_identity), '^[+]', ''))
   order by u.created_at
   limit 1
$$;

revoke all on function public.account_for_identity(text) from public, anon, authenticated;
grant execute on function public.account_for_identity(text) to service_role;

-- The edge functions write these two tables with the service role.
grant insert on public.account_requests to service_role;
grant insert on public.account_deletions to service_role;

-- the request form counts recent rows before adding one, and the deletion
-- function settles requests it has fulfilled
grant select, update, delete on public.account_requests to service_role;
