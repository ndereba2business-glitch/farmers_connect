-- Community becomes one WhatsApp-style group chat.
--
-- Before this, the app had two half-working places to talk: a posts feed
-- (community_posts / community_comments) whose "likes" could never work,
-- because a like tried to update a row owned by someone else and row-level
-- security silently refused it; and a group chat (community_chat) that
-- never updated live, because the table was not in the realtime
-- publication.
--
-- This migration makes community_chat the single group:
--   * photos, reply previews filled in by the server, sender badges
--   * one reaction per person per message
--   * messages can be removed (by their author or an admin), reported by
--     any member, and repeat offenders muted by an admin
--   * a server-side guard: blocked words, a rate limit, and no posting
--     while muted
--   * live updates switched on
--   * the old posts and comments are copied in, so nothing is lost
-- The old tables are left in place, unused.

-- ---------------------------------------------------------------------
-- 1. Messages
-- ---------------------------------------------------------------------
alter table public.community_chat
  add column if not exists image_url text,
  add column if not exists sender_badge text,
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by text;

comment on column public.community_chat.sender_badge is
  'admin, vet or supplier when the sender is one (vets and suppliers only once verified). Set by the insert guard, never by the client.';
comment on column public.community_chat.removed_by is
  'author or admin. A removed message keeps its row (so replies still make sense) but its text and photo are cleared.';

alter table public.community_chat
  add constraint community_chat_message_length check (char_length(coalesce(message, '')) <= 2000),
  add constraint community_chat_badge_known check (sender_badge is null or sender_badge in ('admin', 'vet', 'supplier')),
  add constraint community_chat_removed_by_known check (removed_by is null or removed_by in ('author', 'admin'));

-- paging backwards through the group, and finding replies to a message
create index if not exists community_chat_created_at_idx on public.community_chat (created_at desc);
create index if not exists community_chat_reply_to_id_idx on public.community_chat (reply_to_id) where reply_to_id is not null;
create index if not exists community_chat_sender_recent_idx on public.community_chat (user_email, created_at desc);

-- ---------------------------------------------------------------------
-- 2. Moderation tables
-- ---------------------------------------------------------------------
create table if not exists public.community_blocked_terms (
  term text primary key check (term = lower(btrim(term)) and char_length(term) between 2 and 60),
  kind text not null check (kind in ('abuse', 'off_topic')),
  created_at timestamptz not null default now()
);
comment on table public.community_blocked_terms is
  'Words and phrases that stop a community message being posted. Matched as whole words, case-insensitively. Admin-managed.';

create table if not exists public.community_mutes (
  user_email text primary key,
  muted_until timestamptz not null,
  reason text check (reason is null or char_length(reason) <= 300),
  muted_by text,
  created_at timestamptz not null default now()
);
comment on table public.community_mutes is
  'Members who cannot post in the community until muted_until. user_email is the account identity (email, or phone for phone accounts).';

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.community_chat (id) on delete cascade,
  reporter text not null,
  reason text not null check (char_length(btrim(reason)) between 1 and 300),
  status text not null default 'open' check (status in ('open', 'removed', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (message_id, reporter)
);
create index if not exists community_reports_open_idx on public.community_reports (created_at desc) where status = 'open';

alter table public.community_blocked_terms enable row level security;
alter table public.community_mutes enable row level security;
alter table public.community_reports enable row level security;

-- Blocked terms: admins only. Members never read the list; the insert
-- guard below checks it on their behalf.
create policy community_blocked_terms_admin on public.community_blocked_terms
  for all to authenticated
  using ((select public.is_app_admin()))
  with check ((select public.is_app_admin()));

-- Mutes: a member can see their own (so the app can say until when);
-- only admins can create, change or lift one.
create policy community_mutes_read_own_or_admin on public.community_mutes
  for select to authenticated
  using (user_email = (select public.request_identity()) or (select public.is_app_admin()));
create policy community_mutes_admin_insert on public.community_mutes
  for insert to authenticated with check ((select public.is_app_admin()));
create policy community_mutes_admin_update on public.community_mutes
  for update to authenticated
  using ((select public.is_app_admin())) with check ((select public.is_app_admin()));
create policy community_mutes_admin_delete on public.community_mutes
  for delete to authenticated using ((select public.is_app_admin()));

-- Reports: any member files their own; only admins read and resolve them.
create policy community_reports_insert_own on public.community_reports
  for insert to authenticated
  with check (reporter = (select public.request_identity()) and status = 'open');
create policy community_reports_read_own_or_admin on public.community_reports
  for select to authenticated
  using (reporter = (select public.request_identity()) or (select public.is_app_admin()));
create policy community_reports_admin_update on public.community_reports
  for update to authenticated
  using ((select public.is_app_admin())) with check ((select public.is_app_admin()));

revoke all on public.community_blocked_terms, public.community_mutes, public.community_reports from anon;

-- ---------------------------------------------------------------------
-- 3. Who may write messages
-- ---------------------------------------------------------------------
-- The old "owner_write" policy covered insert, update AND delete, so a
-- member could rewrite or hard-delete their messages at will, breaking
-- replies and dodging moderation. Members now only insert; removal goes
-- through community_remove_message() below.
drop policy if exists "owner_write" on public.community_chat;
create policy community_chat_insert_own on public.community_chat
  for insert to authenticated
  with check (user_email = (select public.request_identity()));

revoke all on public.community_chat from anon;
revoke update, delete, truncate on public.community_chat from authenticated;

-- ---------------------------------------------------------------------
-- 4. Insert guard
-- ---------------------------------------------------------------------
-- Runs for every message a signed-in member sends. The exceptions carry
-- short codes (community_muted, community_too_fast, community_blocked,
-- community_empty) that the app turns into friendly messages.
create or replace function public.community_chat_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ident text := (select public.request_identity());
  profile_name text;
  parent record;
begin
  -- No signed-in member: a migration or the SQL editor. Leave it alone.
  if ident is null then
    return new;
  end if;

  if exists (select 1 from public.community_mutes m where m.user_email = ident and m.muted_until > now()) then
    raise exception 'community_muted' using errcode = 'P0001';
  end if;

  new.message := btrim(coalesce(new.message, ''));
  new.image_url := nullif(btrim(coalesce(new.image_url, '')), '');
  if new.message = '' and new.image_url is null then
    raise exception 'community_empty' using errcode = 'P0001';
  end if;

  if (select count(*) from public.community_chat c
       where c.user_email = ident and c.created_at > now() - interval '1 minute') >= 8 then
    raise exception 'community_too_fast' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.community_blocked_terms t
     where lower(new.message) ~ ('\m' || regexp_replace(t.term, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '\M')
  ) then
    raise exception 'community_blocked' using errcode = 'P0001';
  end if;

  -- Fields the client must not choose for itself.
  new.user_email := ident;
  new.created_at := now();
  new.removed_at := null;
  new.removed_by := null;

  -- The name on the profile, so nobody can post as "Admin" or as
  -- someone else. Falls back to what was sent for accounts with no profile.
  select nullif(btrim(p.full_name), '') into profile_name
    from public.farmer_profiles p where p.user_email = ident limit 1;
  new.user_name := left(coalesce(profile_name, nullif(btrim(coalesce(new.user_name, '')), ''), 'Farmer'), 60);

  new.sender_badge := case
    when (select public.is_app_admin()) then 'admin'
    when exists (select 1 from public.vet_profiles v
                  where v.user_id = (select auth.uid()) and v.verification_status = 'verified') then 'vet'
    when exists (select 1 from public.supplier_profiles s
                  where s.user_id = (select auth.uid()) and s.verification_status = 'verified') then 'supplier'
    else null
  end;

  -- The quoted preview comes from the real message, not from the client.
  new.reply_to_message := null;
  new.reply_to_user := null;
  if new.reply_to_id is not null then
    select c.user_name, c.message, c.image_url, c.removed_at into parent
      from public.community_chat c where c.id = new.reply_to_id;
    if not found or parent.removed_at is not null then
      new.reply_to_id := null;
    else
      new.reply_to_user := parent.user_name;
      new.reply_to_message := left(coalesce(nullif(parent.message, ''), case when parent.image_url is not null then 'Photo' end), 140);
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.community_chat_guard() from public, anon, authenticated;

drop trigger if exists community_chat_guard on public.community_chat;
create trigger community_chat_guard
  before insert on public.community_chat
  for each row execute function public.community_chat_guard();

-- ---------------------------------------------------------------------
-- 5. Removing a message
-- ---------------------------------------------------------------------
-- The author or an admin. The row stays, emptied, so the thread keeps its
-- shape and shows "message removed". Returns false if it was already gone.
create or replace function public.community_remove_message(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  ident text := (select public.request_identity());
  owner_identity text;
  who text;
begin
  if ident is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select c.user_email into owner_identity
    from public.community_chat c
   where c.id = p_message_id and c.removed_at is null
     for update;
  if not found then
    return false;
  end if;

  if owner_identity = ident then
    who := 'author';
  elsif (select public.is_app_admin()) then
    who := 'admin';
  else
    raise exception 'only the author or an admin can remove a message' using errcode = '42501';
  end if;

  update public.community_chat
     set message = '', image_url = null, reply_to_message = null, removed_at = now(), removed_by = who
   where id = p_message_id;

  -- previews quoted in replies, reactions and open reports go with it
  update public.community_chat set reply_to_message = null where reply_to_id = p_message_id;
  delete from public.message_reactions where message_id = p_message_id;
  update public.community_reports
     set status = 'removed', resolved_at = now()
   where message_id = p_message_id and status = 'open';

  return true;
end;
$$;

revoke all on function public.community_remove_message(uuid) from public, anon;
grant execute on function public.community_remove_message(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. One reaction per person per message
-- ---------------------------------------------------------------------
-- The old rule allowed one of EACH emoji, so a person could pile six
-- reactions on a message. Keep each person's most recent, then enforce one.
delete from public.message_reactions r
 using public.message_reactions newer
 where newer.message_id = r.message_id
   and newer.user_email = r.user_email
   and (newer.created_at, newer.id) > (r.created_at, r.id);

alter table public.message_reactions
  drop constraint if exists message_reactions_message_id_user_email_emoji_key;
alter table public.message_reactions
  add constraint message_reactions_one_per_person unique (message_id, user_email),
  add constraint message_reactions_emoji_short check (char_length(emoji) between 1 and 16);

revoke all on public.message_reactions from anon;
revoke truncate on public.message_reactions from authenticated;

-- ---------------------------------------------------------------------
-- 7. Bring the old posts and comments into the group
-- ---------------------------------------------------------------------
-- Posts become messages (same id, so this is safe to run twice) and their
-- comments become replies. The old created_at columns have no time zone
-- and were written in UTC.
insert into public.community_chat (id, user_email, user_name, message, image_url, created_at)
select p.id, p.user_email, left(coalesce(nullif(btrim(p.user_name), ''), 'Farmer'), 60),
       left(btrim(coalesce(p.content, '')), 2000), nullif(btrim(coalesce(p.image_url, '')), ''),
       p.created_at at time zone 'utc'
  from public.community_posts p
 where btrim(coalesce(p.content, '')) <> '' or nullif(btrim(coalesce(p.image_url, '')), '') is not null
on conflict (id) do nothing;

insert into public.community_chat (id, user_email, user_name, message, created_at, reply_to_id, reply_to_user, reply_to_message)
select c.id, c.user_email, left(coalesce(nullif(btrim(c.user_name), ''), 'Farmer'), 60),
       left(btrim(c.content), 2000), c.created_at at time zone 'utc',
       parent.id, parent.user_name, left(coalesce(nullif(parent.message, ''), 'Photo'), 140)
  from public.community_comments c
  join public.community_chat parent on parent.id = c.post_id
 where btrim(coalesce(c.content, '')) <> ''
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 8. Starter list of blocked terms
-- ---------------------------------------------------------------------
-- Abuse, and the spam that actually shows up in open groups (betting,
-- crypto and forex schemes, loan apps, adult content). Deliberately not
-- here: words with honest poultry uses, such as "sex" (sexing chicks,
-- sex-linked breeds) or "loan" on its own (farm loans are a fair topic).
insert into public.community_blocked_terms (term, kind) values
  ('fuck', 'abuse'), ('fucking', 'abuse'), ('fucker', 'abuse'), ('motherfucker', 'abuse'),
  ('bitch', 'abuse'), ('bastard', 'abuse'), ('asshole', 'abuse'), ('shit', 'abuse'),
  ('malaya', 'abuse'), ('kuma', 'abuse'), ('mboro', 'abuse'), ('mkundu', 'abuse'),
  ('msenge', 'abuse'), ('pumbavu', 'abuse'), ('shenzi', 'abuse'), ('umbwa wewe', 'abuse'),
  ('betting', 'off_topic'), ('betika', 'off_topic'), ('sportpesa', 'off_topic'), ('odibets', 'off_topic'),
  ('mozzart', 'off_topic'), ('jackpot', 'off_topic'), ('aviator', 'off_topic'), ('casino', 'off_topic'),
  ('bitcoin', 'off_topic'), ('crypto', 'off_topic'), ('cryptocurrency', 'off_topic'), ('forex', 'off_topic'),
  ('binance', 'off_topic'), ('usdt', 'off_topic'), ('double your money', 'off_topic'),
  ('instant loan', 'off_topic'), ('quick loan', 'off_topic'), ('loan app', 'off_topic'),
  ('porn', 'off_topic'), ('xxx', 'off_topic'), ('nudes', 'off_topic'), ('escort', 'off_topic'),
  ('illuminati', 'off_topic')
on conflict (term) do nothing;

-- ---------------------------------------------------------------------
-- 9. Live updates
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'community_chat') then
    alter publication supabase_realtime add table public.community_chat;
  end if;
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reactions') then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;
