-- Phase 6.2: count farmer contacts (taps on Call / WhatsApp).
--
-- Purpose: show suppliers that farmers are reaching them ("5 farmers
-- contacted you about Layers Mash this month") and give the platform the
-- number that answers "can farmers find suppliers and contact them?".
-- There is no messaging here: the call or WhatsApp chat itself happens
-- outside the app, and this only records that a farmer started one.
--
-- Privacy: the row stores which farmer tapped (so one farmer tapping ten
-- times counts once), but nobody can read the rows directly. Suppliers and
-- admins only get counts, through the two functions below.
--
-- Integrity:
--   * contacted_by is always the caller (default + check), never supplied
--     by the client.
--   * supplier_id is derived by the trigger from the product, or checked
--     against a verified supplier profile for directory contacts, so a
--     client can't credit contacts to the wrong supplier.
--   * one row per farmer / target / channel / UTC day (unique index; the
--     app inserts with ON CONFLICT DO NOTHING), so rows stay bounded.
--   * a supplier (or product owner) tapping their own listing is skipped.

create table if not exists public.contact_events (
  id bigint generated always as identity primary key,
  product_id uuid references public.products (id) on delete set null,
  supplier_id uuid references public.supplier_profiles (id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'call')),
  contacted_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contact_day date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now(),
  constraint contact_events_has_target check (product_id is not null or supplier_id is not null)
);

-- the day is the dedup key; nulls in product_id/supplier_id are made
-- comparable so directory contacts (no product) dedupe too
create unique index if not exists contact_events_once_per_day
  on public.contact_events (
    coalesce(product_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid),
    contacted_by, channel, contact_day
  );

create index if not exists contact_events_supplier_day on public.contact_events (supplier_id, contact_day);
create index if not exists contact_events_day on public.contact_events (contact_day);

alter table public.contact_events enable row level security;

create or replace function public.contact_events_prepare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_email text;
  v_supplier uuid;
  v_supplier_user uuid;
begin
  new.contacted_by := auth.uid();
  new.contact_day := (now() at time zone 'utc')::date;
  new.created_at := now();

  if new.product_id is not null then
    select p.supplier_id, p.user_email into v_supplier, v_owner_email
      from public.products p
     where p.id = new.product_id and p.is_active;
    if not found then
      raise exception 'Product not available';
    end if;
    new.supplier_id := v_supplier;
    -- owners tapping their own listing don't count
    if v_owner_email = public.request_identity() then
      return null;
    end if;
  else
    select sp.user_id into v_supplier_user
      from public.supplier_profiles sp
     where sp.id = new.supplier_id and sp.verification_status = 'verified';
    if not found then
      raise exception 'Supplier not found';
    end if;
  end if;

  if new.supplier_id is not null then
    select sp.user_id into v_supplier_user from public.supplier_profiles sp where sp.id = new.supplier_id;
    if v_supplier_user = auth.uid() then
      return null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_contact_events_prepare on public.contact_events;
create trigger trg_contact_events_prepare
  before insert on public.contact_events
  for each row execute function public.contact_events_prepare();

-- insert only; no select/update/delete policies, so rows are unreadable
create policy "signed-in users record their own contacts" on public.contact_events
  for insert to authenticated
  with check (contacted_by = (select auth.uid()));

-- signed-in users may only insert the three client-supplied columns; a
-- repeat tap the same day hits the unique index and the app treats that
-- duplicate-key error as "already counted"
revoke all on public.contact_events from anon, authenticated;
grant insert (product_id, supplier_id, channel) on public.contact_events to authenticated;

-- Per-product counts for the calling supplier over the last p_days days.
-- product_id is null for contacts made from the supplier directory.
create or replace function public.supplier_contact_summary(p_days integer default 30)
returns table (product_id uuid, farmers bigint, whatsapp bigint, calls bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select e.product_id,
         count(distinct e.contacted_by) as farmers,
         count(distinct e.contacted_by) filter (where e.channel = 'whatsapp') as whatsapp,
         count(distinct e.contacted_by) filter (where e.channel = 'call') as calls
    from public.contact_events e
    join public.supplier_profiles sp on sp.id = e.supplier_id
   where sp.user_id = auth.uid()
     and e.contact_day >= (now() at time zone 'utc')::date - greatest(1, least(coalesce(p_days, 30), 365))
   group by e.product_id
$$;

-- Platform totals for admins (the investor metric).
create or replace function public.admin_contact_stats(p_days integer default 30)
returns table (farmers bigint, suppliers bigint, contacts bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Admins only';
  end if;
  return query
    select count(distinct e.contacted_by),
           count(distinct e.supplier_id),
           count(*)
      from public.contact_events e
     where e.contact_day >= (now() at time zone 'utc')::date - greatest(1, least(coalesce(p_days, 30), 365));
end;
$$;

revoke all on function public.supplier_contact_summary(integer) from public, anon;
revoke all on function public.admin_contact_stats(integer) from public, anon;
grant execute on function public.supplier_contact_summary(integer) to authenticated;
grant execute on function public.admin_contact_stats(integer) to authenticated;
