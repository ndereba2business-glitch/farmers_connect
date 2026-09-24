-- Ownership loopholes found while auditing for supplier product management.
--
-- 1. products: the INSERT policy products_supplier_insert_own allowed any row
--    with supplier_id IS NULL. Permissive policies are OR'd, so this bypassed
--    owner_write entirely: any signed-in user could create a listing with
--    anyone's user_email (and therefore anyone's name) on it. Now a supplier
--    insert must use the caller's own supplier profile AND identity; other
--    inserts still go through owner_write (user_email = caller).
--
-- 2. marketplace-images: the upload and "delete own" policies only checked
--    that the caller was signed in, so any user could delete (or overwrite)
--    any listing's image. Uploads and deletes are now limited to the caller's
--    own folder (<auth.uid()>/...). Existing images at the bucket root stay
--    readable; users just can't delete them anymore.
--    The bucket also gets a 5 MB limit and image-only MIME types, enforced
--    by Storage itself.
--
-- The same "any signed-in user can delete" problem exists on the avatars and
-- farm-gallery buckets; it is left for a separate change because fixing it
-- needs the upload code for those features changed too.

alter policy "products_supplier_insert_own" on public.products
  with check (
    supplier_id in (select sp.id from public.supplier_profiles sp where sp.user_id = (select auth.uid()))
    and user_email = (select public.request_identity())
  );

drop policy if exists "Logged in users can upload marketplace images" on storage.objects;
drop policy if exists "Users can delete own marketplace images" on storage.objects;

create policy "users upload marketplace images to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'marketplace-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users delete own marketplace images" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'marketplace-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'marketplace-images';
