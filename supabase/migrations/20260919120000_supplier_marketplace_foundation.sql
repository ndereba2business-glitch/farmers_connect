-- Supplier dashboard + marketplace foundation, and closes verification
-- holes found while auditing the live schema (2026-09-19).
--
-- Findings this migration fixes:
--
-- 1. vet_profiles / supplier_profiles: the guard triggers only fire BEFORE
--    UPDATE, and both tables let an owner INSERT any column. A vet or
--    supplier with no profile row yet could insert one already marked
--    'verified', skipping admin review entirely.
-- 2. protect_supplier_verification_status() trusted
--    user_metadata.role = 'admin', which any signed-in user can set on
--    themselves via auth.updateUser() (same escalation fixed for vets/admin
--    in 20260916200000). There was also no admin UPDATE policy on
--    supplier_profiles, so a real admin could not verify anyone.
-- 3. orders had SELECT/UPDATE policies for suppliers only: no INSERT policy
--    (marketplace checkout failed for every buyer), no buyer column (a
--    farmer could never see their own orders), no admin read (revenue and
--    analytics pages read empty). Checkout also computed price and the 5%
--    fee in the browser and never set supplier_id / product_id, so orders
--    were invisible to suppliers even where inserts succeeded.
-- 4. Suppliers could rewrite any column of their orders (price, buyer...)
--    because the UPDATE policy is row-level only.
-- 5. products.is_verified could be set by the seller, so the "verified"
--    badge was spoofable.
--
-- The legacy `suppliers` directory table (RLS on, no policies) is left in
-- place and untouched; the directory now reads verified supplier_profiles.

-- ============================================================
-- 0. Shared helper: real admin = app_metadata only (never user_metadata)
-- ============================================================
create or replace function public.is_app_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
$$;

-- ============================================================
-- 1. Verification: guard INSERT as well as UPDATE.
--    auth.uid() is null for the SQL editor / service role, which stay free
--    to set any status.
-- ============================================================
create or replace function public.guard_vet_verification_on_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not public.is_app_admin()
     and coalesce(new.verification_status, '') not in ('unverified', 'pending') then
    new.verification_status := 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_vet_verification_insert on public.vet_profiles;
create trigger trg_guard_vet_verification_insert
  before insert on public.vet_profiles
  for each row execute function public.guard_vet_verification_on_insert();

create or replace function public.guard_supplier_verification_on_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_app_admin() then
    new.verification_status := 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_supplier_verification_insert on public.supplier_profiles;
create trigger trg_guard_supplier_verification_insert
  before insert on public.supplier_profiles
  for each row execute function public.guard_supplier_verification_on_insert();

-- Existing UPDATE trigger (trg_protect_supplier_verification) keeps its
-- name; only the admin check inside the function changes.
create or replace function public.protect_supplier_verification_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.verification_status is distinct from old.verification_status
     and auth.uid() is not null
     and not public.is_app_admin() then
    new.verification_status := old.verification_status;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================
-- 2. supplier_profiles: admin review + verified-supplier directory
-- ============================================================
create policy "admin can view all supplier profiles" on public.supplier_profiles
  for select to authenticated
  using ((select public.is_app_admin()));

create policy "admin can update supplier verification" on public.supplier_profiles
  for update to authenticated
  using ((select public.is_app_admin()))
  with check ((select public.is_app_admin()));

create policy "authenticated can view verified suppliers" on public.supplier_profiles
  for select to authenticated
  using (verification_status = 'verified');

-- ============================================================
-- 3. products: is_verified is admin-controlled
-- ============================================================
create or replace function public.protect_product_verified()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_app_admin() then
    if tg_op = 'INSERT' then
      new.is_verified := false;
    elsif new.is_verified is distinct from old.is_verified then
      new.is_verified := old.is_verified;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_product_verified on public.products;
create trigger trg_protect_product_verified
  before insert or update on public.products
  for each row execute function public.protect_product_verified();

-- ============================================================
-- 4. orders: buyer identity, read access, locked-down writes
-- ============================================================
alter table public.orders
  add column if not exists buyer_id uuid default auth.uid() references auth.users(id) on delete set null,
  add column if not exists customer_phone text;

create index if not exists orders_buyer_id_idx on public.orders (buyer_id);
create index if not exists orders_supplier_id_idx on public.orders (supplier_id);

create policy "orders_buyer_select_own" on public.orders
  for select to authenticated
  using (buyer_id = (select auth.uid()));

create policy "orders_admin_select_all" on public.orders
  for select to authenticated
  using ((select public.is_app_admin()));

-- No client writes except a supplier moving their own order through its
-- lifecycle (row scope comes from orders_supplier_update_delivery_status).
-- Creation goes through place_order() below.
revoke insert, update, delete on public.orders from anon, authenticated;
grant update (delivery_status, status) on public.orders to authenticated;

-- ============================================================
-- 5. place_order(): server-side pricing, one row per line item, atomic.
--    Orders are requests; payment is arranged directly with the supplier.
-- ============================================================
create or replace function public.place_order(
  p_items jsonb,
  p_customer_name text,
  p_county text,
  p_phone text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item  jsonb;
  v_prod  record;
  v_qty   integer;
  v_total numeric;
  v_fee   numeric;
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if coalesce(trim(p_customer_name), '') = ''
     or coalesce(trim(p_county), '') = ''
     or coalesce(trim(p_phone), '') = '' then
    raise exception 'Name, county and phone are required';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 50 then
    raise exception 'Invalid cart';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item ->> 'quantity')::integer, 1);
    if v_qty < 1 or v_qty > 1000 then
      raise exception 'Invalid quantity';
    end if;

    select p.id, p.product_name, p.price, p.supplier_id, p.sold_out,
           p.available_quantity, sp.verification_status
      into v_prod
      from public.products p
      left join public.supplier_profiles sp on sp.id = p.supplier_id
     where p.id = (v_item ->> 'product_id')::uuid;

    if not found then
      raise exception 'Product not found';
    end if;
    if v_prod.supplier_id is null then
      raise exception '% is a contact-seller listing and cannot be ordered here', v_prod.product_name;
    end if;
    if v_prod.verification_status is distinct from 'verified' then
      raise exception '% is not available from a verified supplier', v_prod.product_name;
    end if;
    if coalesce(v_prod.sold_out, false)
       or (v_prod.available_quantity is not null and v_prod.available_quantity < v_qty) then
      raise exception '% is not available in that quantity', v_prod.product_name;
    end if;
    if coalesce(v_prod.price, 0) <= 0 then
      raise exception '% has no price set', v_prod.product_name;
    end if;

    v_total := round(v_prod.price * v_qty, 2);
    v_fee   := round(v_total * 0.05, 2);

    insert into public.orders (
      product_id, product_name, supplier_id, buyer_id,
      customer_name, customer_phone, county, quantity,
      total_price, platform_fee, supplier_earnings,
      status, delivery_status
    ) values (
      v_prod.id, v_prod.product_name, v_prod.supplier_id, auth.uid(),
      trim(p_customer_name), trim(p_phone), trim(p_county), v_qty,
      v_total, v_fee, v_total - v_fee,
      'pending', 'pending'
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.place_order(jsonb, text, text, text) from public, anon;
grant execute on function public.place_order(jsonb, text, text, text) to authenticated;

comment on table public.suppliers is
  'Legacy directory table, superseded by supplier_profiles (verified rows). Unused by the app; RLS on with no policies.';
