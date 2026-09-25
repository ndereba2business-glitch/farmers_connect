-- Phase 5: inventory & availability, pricing.
--
-- availability   in_stock | out_of_stock | on_order ("available on order":
--                the supplier can get it, with a lead time). Replaces the
--                yes/no sold_out flag as the source of truth. sold_out is
--                kept and synced by trigger in both directions, because the
--                farmer listing form, the old seller controls and
--                place_order() still read or write it.
-- price_max      optional top of a price range ("KES 3,000 - 3,400"); price
--                stays the from-price. Must be above price when set.
-- min_order_qty  optional minimum order, in the product's unit.
-- updated_at     when the listing last changed, or was confirmed "still
--                available" by its owner. The app shows it to farmers and
--                flags listings not updated in 30 days, so stale listings
--                can't quietly look available. It moves only when a listing
--                field changes (or the owner explicitly confirms), not on
--                admin-only flags like is_verified, and the client can't
--                backdate or future-date it.

alter table public.products
  add column if not exists availability text not null default 'in_stock',
  add column if not exists price_max numeric,
  add column if not exists min_order_qty integer,
  add column if not exists updated_at timestamptz not null default now();

alter table public.products
  add constraint products_availability_valid
    check (availability in ('in_stock', 'out_of_stock', 'on_order')),
  add constraint products_price_max_above_price
    check (price_max is null or price_max > price),
  add constraint products_min_order_qty_range
    check (min_order_qty is null or min_order_qty between 1 and 1000000);

-- existing rows: sold out -> out_of_stock; last update = when they were
-- listed (created_at is a UTC timestamp without time zone)
update public.products
set availability = case when coalesce(sold_out, false) then 'out_of_stock' else 'in_stock' end,
    updated_at = coalesce(created_at at time zone 'utc', now());

create or replace function public.products_sync_availability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- legacy inserts only set sold_out
    if coalesce(new.sold_out, false) and new.availability = 'in_stock' then
      new.availability := 'out_of_stock';
    end if;
    new.sold_out := new.availability = 'out_of_stock';
    new.updated_at := now();
    return new;
  end if;

  if new.availability is distinct from old.availability then
    new.sold_out := new.availability = 'out_of_stock';
  elsif new.sold_out is distinct from old.sold_out then
    new.availability := case
      when coalesce(new.sold_out, false) then 'out_of_stock'
      when old.availability = 'out_of_stock' then 'in_stock'
      else old.availability
    end;
  end if;

  if (new.product_name, new.category, new.description, new.price, new.price_max, new.unit,
      new.stock, new.min_order_qty, new.availability, new.is_active, new.image_url,
      new.county, new.location_details, new.seller_phone)
     is distinct from
     (old.product_name, old.category, old.description, old.price, old.price_max, old.unit,
      old.stock, old.min_order_qty, old.availability, old.is_active, old.image_url,
      old.county, old.location_details, old.seller_phone)
     or new.updated_at is distinct from old.updated_at then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_products_sync_availability on public.products;
create trigger trg_products_sync_availability
  before insert or update on public.products
  for each row execute function public.products_sync_availability();
