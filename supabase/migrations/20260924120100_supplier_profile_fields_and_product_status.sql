-- Schema for supplier profile (Phase 3) and product management (Phase 4).
--
-- supplier_profiles
--   logo_url            public URL of an image in the supplier's own folder
--                       of marketplace-images
--   location_details    town / market / landmark, alongside county
--   operating_hours     optional free text, e.g. "Mon-Sat 8am-6pm"
--   product_categories  what the supplier sells; same values as the
--                       marketplace's products.category so the directory and
--                       product filters line up. Backfilled from the older
--                       single-value supplier_type (hatchery -> chickens).
--
-- products
--   is_active           false = hidden from farmers ("deactivated"), which is
--                       different from sold_out (still visible, marked out of
--                       stock). Enforced in the SELECT policy, not just in
--                       the UI: inactive rows are only visible to their owner
--                       and admins.
--
-- Deleting a product: orders.product_id had no ON DELETE action, so any
-- product with order history could not be deleted. Order rows already keep
-- their own copy of product_name, price and supplier, so the link is now set
-- to NULL instead and the history survives.
--
-- Suppliers could update their products through supplier_id but only delete
-- them through user_email; a matching DELETE policy is added.
--
-- place_order() is SECURITY DEFINER (it bypasses RLS), so it checks is_active
-- itself. In-app ordering is hidden in the UI for the MVP, but the function
-- must not accept orders for hidden products either way.

alter table public.supplier_profiles
  add column if not exists logo_url text,
  add column if not exists location_details text,
  add column if not exists operating_hours text,
  add column if not exists product_categories text[] not null default '{}';

alter table public.supplier_profiles
  add constraint supplier_profiles_logo_url_https
    check (logo_url is null or logo_url like 'https://%'),
  add constraint supplier_profiles_location_details_len
    check (location_details is null or char_length(location_details) <= 120),
  add constraint supplier_profiles_operating_hours_len
    check (operating_hours is null or char_length(operating_hours) <= 120),
  add constraint supplier_profiles_product_categories_valid
    check (product_categories <@ array['chickens', 'eggs', 'feeds', 'equipment', 'medicine', 'other']::text[]);

update public.supplier_profiles
set product_categories = array[
  case supplier_type when 'hatchery' then 'chickens' else supplier_type end
]
where cardinality(product_categories) = 0
  and supplier_type in ('feeds', 'hatchery', 'medicine', 'equipment', 'other');

alter table public.products
  add column if not exists is_active boolean not null default true;

create index if not exists products_supplier_id_idx on public.products (supplier_id);

alter policy "everyone_read" on public.products
  using (
    (select auth.role()) = 'authenticated'
    and (
      is_active
      or user_email = (select public.request_identity())
      or supplier_id in (select sp.id from public.supplier_profiles sp where sp.user_id = (select auth.uid()))
      or (select public.is_app_admin())
    )
  );

create policy "products_supplier_delete_own" on public.products
  for delete to authenticated
  using (
    supplier_id in (select sp.id from public.supplier_profiles sp where sp.user_id = (select auth.uid()))
  );

alter table public.orders drop constraint if exists orders_product_id_fkey;
alter table public.orders
  add constraint orders_product_id_fkey
  foreign key (product_id) references public.products (id) on delete set null;

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

    select p.id, p.product_name, p.price, p.supplier_id, p.sold_out, p.is_active,
           p.stock, sp.verification_status
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
    if not v_prod.is_active
       or coalesce(v_prod.sold_out, false)
       or (coalesce(v_prod.stock, 0) > 0 and v_prod.stock < v_qty) then
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
