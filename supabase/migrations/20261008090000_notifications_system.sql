-- A working notification system.
--
-- Until now the app created notifications from the browser of whoever
-- caused the event ("vet accepted your visit" was inserted by the vet's
-- phone). Row-level security only lets a person write their own
-- notifications, so every notification meant for someone else was
-- silently refused, and nobody could turn any of them off.
--
-- This migration moves notification creation into the database:
--   * triggers create the notification for the right person when the
--     event happens (community replies and reactions, moderation, vet
--     answers, visit requests and decisions, vet-farmer messages, farmer
--     contacts, orders, verification decisions)
--   * sync_my_reminders() creates the time-based ones (vaccinations and
--     tasks due or overdue, visits today or tomorrow) when the person
--     opens the app. Notifications are in-app only, so that is exactly
--     when they would be seen; no background scheduler is needed.
--   * notification_preferences holds each person's choices, and one
--     insert guard enforces them for every source, including the few
--     notifications the app still writes for the signed-in user.

-- ---------------------------------------------------------------------
-- 1. The notifications table
-- ---------------------------------------------------------------------
-- created_at had no time zone and was written in UTC, so the app showed
-- every new notification as "3h ago" in Kenya.
alter table public.notifications
  alter column created_at type timestamptz using created_at at time zone 'utc';

alter table public.notifications
  add column if not exists category text,
  add column if not exists dedupe_key text,
  add column if not exists cleared_at timestamptz;

comment on column public.notifications.category is
  'Which preference switch governs this notification. Derived from type by the insert guard.';
comment on column public.notifications.dedupe_key is
  'Set by server-created notifications so the same event is never announced twice to the same person.';
comment on column public.notifications.cleared_at is
  '"Clear all" hides notifications instead of deleting them, so their dedupe keys keep working.';

create unique index if not exists notifications_dedupe_idx
  on public.notifications (user_email, dedupe_key) where dedupe_key is not null;
create index if not exists notifications_inbox_idx
  on public.notifications (user_email, created_at desc) where cleared_at is null;

revoke all on public.notifications from anon;
revoke truncate on public.notifications from authenticated;

-- ---------------------------------------------------------------------
-- 2. Preferences
-- ---------------------------------------------------------------------
-- One row per person, created the first time they change a setting. No
-- row means everything is on. The master switch is the existing
-- farmer_profiles.notifications_enabled column (every account, whatever
-- its role, has a farmer_profiles row).
create table if not exists public.notification_preferences (
  user_email text primary key,
  vaccinations boolean not null default true,
  farm boolean not null default true,
  vet boolean not null default true,
  community boolean not null default true,
  marketplace boolean not null default true,
  clucky boolean not null default true,
  updated_at timestamptz not null default now()
);
comment on table public.notification_preferences is
  'Per-person notification switches. user_email is the account identity (email, or phone for phone accounts).';

alter table public.notification_preferences enable row level security;

create policy notification_preferences_read_own on public.notification_preferences
  for select to authenticated using (user_email = (select public.request_identity()));
create policy notification_preferences_insert_own on public.notification_preferences
  for insert to authenticated with check (user_email = (select public.request_identity()));
create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated
  using (user_email = (select public.request_identity()))
  with check (user_email = (select public.request_identity()));

revoke all on public.notification_preferences from anon;
revoke delete, truncate on public.notification_preferences from authenticated;

-- Which switch a notification type belongs to. Anything unknown is an
-- "account" notice (verification decisions, moderation), which has no
-- switch of its own and is only silenced by the master switch.
create or replace function public.notification_category(p_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_type = 'vaccination' then 'vaccinations'
    when p_type in ('task', 'finance', 'general') then 'farm'
    when p_type in ('vet', 'appointment') then 'vet'
    when p_type in ('community', 'chat') then 'community'
    when p_type in ('marketplace', 'order') then 'marketplace'
    when p_type = 'clucky' then 'clucky'
    else 'account'
  end
$$;

-- ---------------------------------------------------------------------
-- 3. Insert guard: applies everyone's preferences to every source
-- ---------------------------------------------------------------------
-- Returning null from a BEFORE trigger skips the insert without an error,
-- so callers don't need to know about preferences at all.
create or replace function public.notifications_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed text;
begin
  if new.user_email is null or btrim(new.user_email) = '' then
    return null;
  end if;

  new.category := public.notification_category(new.type);
  new.title := left(coalesce(new.title, ''), 120);
  new.message := left(coalesce(new.message, ''), 400);
  new.read := false;
  new.cleared_at := null;
  new.created_at := now();

  if exists (select 1 from public.farmer_profiles p
              where p.user_email = new.user_email and p.notifications_enabled is false) then
    return null;
  end if;

  select to_jsonb(np) ->> new.category into allowed
    from public.notification_preferences np where np.user_email = new.user_email;
  if allowed = 'false' then
    return null;
  end if;

  return new;
end;
$$;

revoke all on function public.notifications_guard() from public, anon, authenticated;

drop trigger if exists notifications_guard on public.notifications;
create trigger notifications_guard
  before insert on public.notifications
  for each row execute function public.notifications_guard();

-- ---------------------------------------------------------------------
-- 4. Internal helpers (not callable from the app)
-- ---------------------------------------------------------------------
-- A failed notification must never undo the action that caused it (a
-- sent message, an accepted visit), so errors are swallowed here.
create or replace function public.push_notification(
  p_user_email text, p_type text, p_title text, p_message text,
  p_link text default null, p_dedupe_key text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_email is null or btrim(p_user_email) = '' then
    return;
  end if;
  insert into public.notifications (user_email, type, title, message, link, dedupe_key)
  values (p_user_email, p_type, p_title, p_message, p_link, p_dedupe_key)
  on conflict (user_email, dedupe_key) where dedupe_key is not null do nothing;
exception when others then
  raise warning 'push_notification failed for type %: %', p_type, sqlerrm;
end;
$$;

revoke all on function public.push_notification(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.push_notification(text, text, text, text, text, text) to service_role;

-- The identity notifications are addressed to (email, or phone for
-- phone-only accounts), from an auth user id.
create or replace function public.identity_of_user(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(u.email, ''), nullif(u.phone, '')) from auth.users u where u.id = p_user_id
$$;

revoke all on function public.identity_of_user(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Community
-- ---------------------------------------------------------------------
create or replace function public.notify_community_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_author text;
begin
  if tg_op = 'INSERT' then
    if new.reply_to_id is not null then
      select c.user_email into parent_author from public.community_chat c where c.id = new.reply_to_id;
      if parent_author is not null and parent_author <> new.user_email then
        perform public.push_notification(
          parent_author, 'community',
          coalesce(new.user_name, 'A member') || ' replied to you',
          left(coalesce(nullif(new.message, ''), 'Photo'), 140),
          '/community', 'reply:' || new.id);
      end if;
    end if;
  elsif new.removed_by = 'admin' and old.removed_at is null then
    perform public.push_notification(
      new.user_email, 'moderation', 'An admin removed your message',
      'One of your messages in the community was removed because it broke the group rules. Open the group and tap the i button to read them.',
      '/community', 'removed:' || new.id);
  end if;
  return null;
end;
$$;

create or replace function public.notify_community_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author text;
  preview text;
  reactor_name text;
begin
  select c.user_email, c.message into author, preview
    from public.community_chat c where c.id = new.message_id and c.removed_at is null;
  if author is null or author = new.user_email then
    return null;
  end if;
  select nullif(btrim(p.full_name), '') into reactor_name
    from public.farmer_profiles p where p.user_email = new.user_email limit 1;
  -- keyed on message + person, so changing the emoji doesn't notify again
  perform public.push_notification(
    author, 'community',
    coalesce(reactor_name, 'A member') || ' reacted ' || new.emoji || ' to your message',
    left(coalesce(nullif(preview, ''), 'Photo'), 100),
    '/community', 'react:' || new.message_id || ':' || new.user_email);
  return null;
end;
$$;

create or replace function public.notify_community_mute()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.muted_until > now() then
    perform public.push_notification(
      new.user_email, 'moderation', 'Your posting in the community is paused',
      'An admin has paused your posting until ' || to_char(new.muted_until at time zone 'Africa/Nairobi', 'DD Mon, HH24:MI')
        || '. You can still read the group.',
      '/community', 'mute:' || to_char(new.muted_until, 'YYYYMMDDHH24MI'));
  end if;
  return null;
end;
$$;

drop trigger if exists notify_community_message_insert on public.community_chat;
create trigger notify_community_message_insert
  after insert on public.community_chat
  for each row execute function public.notify_community_message();

drop trigger if exists notify_community_message_removed on public.community_chat;
create trigger notify_community_message_removed
  after update of removed_at on public.community_chat
  for each row execute function public.notify_community_message();

drop trigger if exists notify_community_reaction on public.message_reactions;
create trigger notify_community_reaction
  after insert on public.message_reactions
  for each row execute function public.notify_community_reaction();

drop trigger if exists notify_community_mute on public.community_mutes;
create trigger notify_community_mute
  after insert or update of muted_until on public.community_mutes
  for each row execute function public.notify_community_mute();

-- ---------------------------------------------------------------------
-- 6. Vets: answers, visits, messages
-- ---------------------------------------------------------------------
create or replace function public.notify_vet_answer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.answer, '') <> '' and new.answer is distinct from old.answer then
    perform public.push_notification(
      new.user_email, 'vet', 'A vet answered your question',
      left(new.answer, 140), '/bookings', 'answer:' || new.id || ':' || md5(new.answer));
  end if;
  return null;
end;
$$;

drop trigger if exists notify_vet_answer on public.vet_questions;
create trigger notify_vet_answer
  after update of answer on public.vet_questions
  for each row execute function public.notify_vet_answer();

create or replace function public.notify_vet_appointment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor text := (select public.request_identity());
  vet text;
  farm text := coalesce(nullif(btrim(new.farm_name), ''), 'A farmer');
  day text := to_char(new.appointment_date, 'DD Mon');
begin
  vet := coalesce(
    new.vet_email,
    public.identity_of_user((select v.user_id from public.vet_profiles v where v.id = coalesce(new.vet_id, new.requested_vet_id)))
  );

  if tg_op = 'INSERT' then
    -- an open request has no single vet to tell; vets see those in Appointments
    perform public.push_notification(
      vet, 'appointment', 'New visit request',
      farm || ' asked for a visit on ' || day || '.', '/appointments', 'appt-new:' || new.id);
    return null;
  end if;

  if new.status is not distinct from old.status then
    return null;
  end if;

  if new.status = 'accepted' then
    perform public.push_notification(
      new.farmer_email, 'appointment', 'Visit request accepted',
      'Your visit for ' || farm || ' on ' || day || ' was accepted.', '/bookings', 'appt:' || new.id || ':accepted');
  elsif new.status = 'rejected' then
    perform public.push_notification(
      new.farmer_email, 'appointment', 'Visit request declined',
      'The vet could not take your visit on ' || day || '.'
        || coalesce(' Reason: ' || nullif(btrim(new.rejection_reason), '') || '.', '')
        || ' You can ask another vet.',
      '/bookings', 'appt:' || new.id || ':rejected');
  elsif new.status = 'completed' then
    perform public.push_notification(
      new.farmer_email, 'appointment', 'Visit completed',
      'The vet has completed the visit for ' || farm || '. The report is in Ask Vet.', '/bookings', 'appt:' || new.id || ':completed');
  elsif new.status = 'cancelled' then
    -- tell whoever did not cancel
    if actor is not distinct from new.farmer_email then
      perform public.push_notification(
        vet, 'appointment', 'Visit cancelled',
        farm || ' cancelled their visit on ' || day || '.', '/appointments', 'appt:' || new.id || ':cancelled');
    else
      perform public.push_notification(
        new.farmer_email, 'appointment', 'Visit cancelled',
        'Your visit on ' || day || ' was cancelled.', '/bookings', 'appt:' || new.id || ':cancelled');
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists notify_vet_appointment_insert on public.vet_appointments;
create trigger notify_vet_appointment_insert
  after insert on public.vet_appointments
  for each row execute function public.notify_vet_appointment();

drop trigger if exists notify_vet_appointment_status on public.vet_appointments;
create trigger notify_vet_appointment_status
  after update of status on public.vet_appointments
  for each row execute function public.notify_vet_appointment();

create or replace function public.notify_vet_farmer_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  from_vet boolean := new.sender_email is not distinct from new.vet_email;
begin
  -- one notification per conversation per hour, not one per message
  perform public.push_notification(
    case when from_vet then new.farmer_email else new.vet_email end,
    'vet',
    case when from_vet then 'New message from your vet' else 'New message from a farmer' end,
    left(coalesce(new.message, ''), 140),
    case when from_vet then '/bookings' else '/vet/farmers' end,
    'vfm:' || coalesce(new.vet_email, '') || ':' || coalesce(new.farmer_email, '') || ':' || to_char(now(), 'YYYYMMDDHH24'));
  return null;
end;
$$;

drop trigger if exists notify_vet_farmer_message on public.vet_farmer_messages;
create trigger notify_vet_farmer_message
  after insert on public.vet_farmer_messages
  for each row execute function public.notify_vet_farmer_message();

-- ---------------------------------------------------------------------
-- 7. Marketplace: contacts and orders
-- ---------------------------------------------------------------------
-- The supplier learns that a farmer got in touch and about which product,
-- never who: contact identities stay private, as decided for contact counts.
create or replace function public.notify_supplier_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_identity text;
  product text;
begin
  select public.identity_of_user(s.user_id) into owner_identity
    from public.supplier_profiles s where s.id = new.supplier_id;
  select p.product_name into product from public.products p where p.id = new.product_id;
  perform public.push_notification(
    owner_identity, 'marketplace', 'A farmer contacted you',
    'A farmer reached out by ' || case when new.channel = 'whatsapp' then 'WhatsApp' else 'phone' end
      || coalesce(' about ' || product, '') || '. Reply quickly: farmers often contact several suppliers.',
    '/supplier',
    'contact:' || coalesce(new.product_id::text, 'profile') || ':' || coalesce(new.contacted_by::text, '') || ':' || new.contact_day);
  return null;
end;
$$;

drop trigger if exists notify_supplier_contact on public.contact_events;
create trigger notify_supplier_contact
  after insert on public.contact_events
  for each row execute function public.notify_supplier_contact();

-- In-app ordering is switched off in the app (IN_APP_ORDERING), so these
-- do nothing today; they are here so orders announce themselves the day
-- it is switched on.
create or replace function public.notify_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item text := coalesce(new.quantity::text || ' x ', '') || coalesce(new.product_name, 'an item');
begin
  if tg_op = 'INSERT' then
    perform public.push_notification(
      public.identity_of_user((select s.user_id from public.supplier_profiles s where s.id = new.supplier_id)),
      'order', 'New order request',
      coalesce(nullif(btrim(new.customer_name), ''), 'A farmer') || ' asked for ' || item || '.',
      '/supplier-orders', 'order-new:' || new.id);
  elsif new.status is distinct from old.status then
    perform public.push_notification(
      public.identity_of_user(new.buyer_id), 'order', 'Your order is now ' || new.status,
      'Your order for ' || item || ' was updated by the supplier.', '/orders',
      'order:' || new.id || ':' || new.status);
  end if;
  return null;
end;
$$;

drop trigger if exists notify_order_insert on public.orders;
create trigger notify_order_insert
  after insert on public.orders
  for each row execute function public.notify_order();

drop trigger if exists notify_order_status on public.orders;
create trigger notify_order_status
  after update of status on public.orders
  for each row execute function public.notify_order();

-- ---------------------------------------------------------------------
-- 8. Verification decisions
-- ---------------------------------------------------------------------
create or replace function public.notify_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_vet boolean := tg_table_name = 'vet_profiles';
  link text := case when is_vet then '/vet-profile' else '/supplier-profile' end;
  what text := case when is_vet then 'vet' else 'supplier' end;
begin
  if new.verification_status is not distinct from old.verification_status then
    return null;
  end if;
  if new.verification_status = 'verified' then
    perform public.push_notification(
      public.identity_of_user(new.user_id), 'verification', 'You are verified',
      'Your ' || what || ' profile has been approved. Farmers can now find you.',
      link, 'verification:' || new.id || ':verified:' || to_char(now(), 'YYYYMMDD'));
  elsif new.verification_status in ('rejected', 'suspended') then
    perform public.push_notification(
      public.identity_of_user(new.user_id), 'verification',
      case when new.verification_status = 'rejected' then 'Your profile needs changes' else 'Your profile has been suspended' end,
      'An admin reviewed your ' || what || ' profile. Open it to see what to do next.',
      link, 'verification:' || new.id || ':' || new.verification_status || ':' || to_char(now(), 'YYYYMMDD'));
  end if;
  return null;
end;
$$;

drop trigger if exists notify_verification on public.vet_profiles;
create trigger notify_verification
  after update of verification_status on public.vet_profiles
  for each row execute function public.notify_verification();

drop trigger if exists notify_verification on public.supplier_profiles;
create trigger notify_verification
  after update of verification_status on public.supplier_profiles
  for each row execute function public.notify_verification();

revoke all on function
  public.notify_community_message(), public.notify_community_reaction(), public.notify_community_mute(),
  public.notify_vet_answer(), public.notify_vet_appointment(), public.notify_vet_farmer_message(),
  public.notify_supplier_contact(), public.notify_order(), public.notify_verification()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 9. Reminders, created when the person opens the app
-- ---------------------------------------------------------------------
-- Overdue work is summarised in one notification per day (replacing the
-- previous day's), never one per item: a farmer with 20 overdue
-- vaccinations gets one line, not 20. Returns how many are unread.
create or replace function public.sync_my_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ident text := (select public.request_identity());
  today date := (now() at time zone 'Africa/Nairobi')::date;
  n integer;
  names text;
  appt record;
begin
  if ident is null then
    return 0;
  end if;

  -- vaccinations on active batches
  delete from public.notifications
   where user_email = ident
     and (dedupe_key like 'vacc-overdue:%' or dedupe_key like 'vacc-today:%' or dedupe_key like 'vacc-tomorrow:%'
          or dedupe_key like 'tasks-overdue:%' or dedupe_key like 'tasks-today:%')
     and dedupe_key not like '%:' || today;

  select count(*), string_agg(label, ', ') filter (where rn <= 3) into n, names
    from (select t.vaccine_name || ' (' || b.batch_name || ')' as label, row_number() over (order by t.scheduled_date) rn
            from public.vaccination_tasks t
            join public.farm_batches b on b.id = t.batch_id and b.status = 'active'
           where t.user_email = ident and not coalesce(t.completed, false) and t.scheduled_date < today) due;
  if n > 0 then
    perform public.push_notification(
      ident, 'vaccination',
      n || case when n = 1 then ' vaccination is overdue' else ' vaccinations are overdue' end,
      names || case when n > 3 then ' and ' || (n - 3) || ' more' else '' end || '. Late vaccines leave the flock unprotected.',
      '/my-farm', 'vacc-overdue:' || today);
  end if;

  select count(*), string_agg(label, ', ') filter (where rn <= 3) into n, names
    from (select t.vaccine_name || ' (' || b.batch_name || ')' as label, row_number() over (order by t.vaccine_name) rn
            from public.vaccination_tasks t
            join public.farm_batches b on b.id = t.batch_id and b.status = 'active'
           where t.user_email = ident and not coalesce(t.completed, false) and t.scheduled_date = today) due;
  if n > 0 then
    perform public.push_notification(
      ident, 'vaccination',
      case when n = 1 then 'Vaccination due today' else n || ' vaccinations due today' end,
      names || case when n > 3 then ' and ' || (n - 3) || ' more' else '' end || '.',
      '/my-farm', 'vacc-today:' || today);
  end if;

  select count(*), string_agg(label, ', ') filter (where rn <= 3) into n, names
    from (select t.vaccine_name || ' (' || b.batch_name || ')' as label, row_number() over (order by t.vaccine_name) rn
            from public.vaccination_tasks t
            join public.farm_batches b on b.id = t.batch_id and b.status = 'active'
           where t.user_email = ident and not coalesce(t.completed, false) and t.scheduled_date = today + 1) due;
  if n > 0 then
    perform public.push_notification(
      ident, 'vaccination',
      case when n = 1 then 'Vaccination due tomorrow' else n || ' vaccinations due tomorrow' end,
      names || case when n > 3 then ' and ' || (n - 3) || ' more' else '' end || '. Buy the vaccine today if you have not.',
      '/my-farm', 'vacc-tomorrow:' || today);
  end if;

  -- farm tasks
  select count(*) into n from public.farm_tasks t
   where t.user_email = ident and not coalesce(t.completed, false) and t.due_date < today;
  if n > 0 then
    perform public.push_notification(
      ident, 'task',
      n || case when n = 1 then ' task is overdue' else ' tasks are overdue' end,
      'Open Tasks to finish or reschedule ' || case when n = 1 then 'it' else 'them' end || '.',
      '/tasks', 'tasks-overdue:' || today);
  end if;

  select count(*), string_agg(t.title, ', ') into n, names
    from (select title from public.farm_tasks
           where user_email = ident and not coalesce(completed, false) and due_date = today
           order by title limit 3) t;
  if n > 0 then
    perform public.push_notification(
      ident, 'task', 'Due today', left(names, 300), '/tasks', 'tasks-today:' || today);
  end if;

  -- accepted visits today or tomorrow, for the farmer and for the vet
  for appt in
    select a.id, a.appointment_date, a.appointment_time, a.farm_name, a.farmer_email, a.vet_email
      from public.vet_appointments a
     where a.status = 'accepted' and a.appointment_date in (today, today + 1)
       and (a.farmer_email = ident or a.vet_email = ident)
  loop
    perform public.push_notification(
      ident, 'appointment',
      'Vet visit ' || case when appt.appointment_date = today then 'today' else 'tomorrow' end
        || coalesce(' at ' || nullif(btrim(appt.appointment_time), ''), ''),
      case when appt.vet_email = ident
           then 'Visit to ' || coalesce(nullif(btrim(appt.farm_name), ''), 'a farm') || '.'
           else 'Your vet is coming to ' || coalesce(nullif(btrim(appt.farm_name), ''), 'your farm') || '. Have the birds and your records ready.' end,
      case when appt.vet_email = ident then '/appointments' else '/bookings' end,
      'appt-soon:' || appt.id || ':' || appt.appointment_date);
  end loop;

  -- housekeeping: forget what was cleared a month ago and anything older than 90 days
  delete from public.notifications
   where user_email = ident
     and ((cleared_at is not null and cleared_at < now() - interval '30 days') or created_at < now() - interval '90 days');

  return (select count(*) from public.notifications where user_email = ident and not read and cleared_at is null);
end;
$$;

revoke all on function public.sync_my_reminders() from public, anon;
grant execute on function public.sync_my_reminders() to authenticated;
