-- place_order() rejected every order: it checked products.available_quantity,
-- which defaults to 0 and is never set by the listing form. Sellers actually
-- use `stock` (shown on the card as "N available") and `sold_out`, so use
-- those: sold_out rejects the order, and a positive stock smaller than the
-- requested quantity rejects it. stock = 0 means "not specified", not out of
-- stock.
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
    if coalesce(v_prod.sold_out, false)
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
