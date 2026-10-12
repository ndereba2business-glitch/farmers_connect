-- Marketplace: a farmer could not remove their own listing.
--
-- Root cause. contact_events.product_id pointed at products with
-- ON DELETE SET NULL, while the table's own rule contact_events_has_target
-- says a row must keep a product or a supplier. A farmer's listing has no
-- supplier, so as soon as one other farmer had tapped Call or WhatsApp on
-- it, deleting the listing tried to blank the only target of that contact
-- row and Postgres refused the whole delete (23514). The page ignored the
-- error, so "Remove" simply did nothing. Supplier listings mostly escaped
-- because their contact rows also carry the supplier, but they could hit
-- the same wall through the once-per-day unique index when two rows
-- collapsed onto the same key.
--
-- Fix. A contact row is a record of something that happened; removing the
-- listing afterwards should not rewrite it. product_id therefore stops
-- being a foreign key and becomes a plain reference that may outlive the
-- product. Nothing else changes: the insert trigger still refuses a
-- contact for a product that does not exist or is hidden, the counts
-- suppliers and admins see are unchanged, and the rows are still removed
-- with the supplier profile or the contacting farmer's account.

alter table public.contact_events
  drop constraint if exists contact_events_product_id_fkey;

comment on column public.contact_events.product_id is
  'The listing the farmer contacted about. Checked when the row is written (contact_events_prepare); deliberately not a foreign key, so the count survives the listing being removed.';

-- ---------------------------------------------------------------------
-- Admins can take a listing down
-- ---------------------------------------------------------------------
-- Until now only the owner could delete a product, so a listing that
-- broke the rules, or an old one with no owner recorded, could not be
-- removed by anyone. Admin here means app_metadata, never a role the
-- account gave itself.
drop policy if exists "products_admin_delete" on public.products;
create policy "products_admin_delete" on public.products
  for delete to authenticated
  using ((select public.is_app_admin()));

-- The owner is told when someone else removed their listing. Their own
-- removals need no notice.
create or replace function public.notify_product_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_identity text;
begin
  if not public.is_app_admin() then
    return null;
  end if;

  owner_identity := nullif(btrim(coalesce(old.user_email, '')), '');
  if owner_identity is null and old.supplier_id is not null then
    select public.identity_of_user(s.user_id) into owner_identity
      from public.supplier_profiles s where s.id = old.supplier_id;
  end if;
  if owner_identity is null or owner_identity = public.request_identity() then
    return null;
  end if;

  perform public.push_notification(
    owner_identity, 'moderation', 'A listing of yours was removed',
    '"' || left(coalesce(old.product_name, 'Your listing'), 80)
      || '" was removed from the marketplace by an administrator. If you think this was a mistake, contact support.',
    '/marketplace', 'product-removed:' || old.id);
  return null;
end;
$$;

revoke all on function public.notify_product_removed() from public, anon, authenticated;

drop trigger if exists notify_product_removed on public.products;
create trigger notify_product_removed
  after delete on public.products
  for each row execute function public.notify_product_removed();
