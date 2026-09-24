-- Storage and farmer-verification fixes found in the post-Phase 4 audit.
--
-- 1. avatars / farm-gallery: the "delete own" (and avatars' "update own")
--    policies only checked that the caller was signed in, so any user could
--    delete or overwrite anyone's profile photo or farm photos. Uploads,
--    overwrites and deletes are now limited to the caller's own folder
--    (<auth.uid()>/...), the same rule marketplace-images got in
--    20260924120000. community-posts gets the same upload rule (its delete
--    rule already was own-folder), so all photo buckets behave alike.
--    Existing files sit at the bucket root; they stay readable, owners just
--    can't delete those old files from the app anymore.
--
-- 2. The "Restrict file size ..." INSERT policies never restricted
--    anything: permissive policies are OR'd, so the plain "logged in users
--    can upload" policy next to them already let any size through. They are
--    replaced by the bucket's own limits (5 MB, JPEG/PNG/WebP), which
--    Storage enforces. The app shrinks photos before upload, so real
--    uploads are a few hundred KB.
--
-- 3. farmer_profiles.verified: admins had no UPDATE policy on
--    farmer_profiles, so "Verify farmer" on /verifications silently changed
--    nothing, while the owner_full_access policy let any farmer set
--    verified = true on their own row. Now only an admin can change it
--    (trigger, like vet_profiles / supplier_profiles), and admins get an
--    UPDATE policy. No farmer is verified today, so nothing is reset.

-- ---------------------------------------------------------------- avatars
drop policy if exists "Users can upload own avatar" on storage.objects;
drop policy if exists "Restrict file size avatars" on storage.objects;
drop policy if exists "Users can update own avatar" on storage.objects;
drop policy if exists "Users can delete own avatar" on storage.objects;

create policy "users upload avatars to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "users update own avatars" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "users delete own avatars" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ----------------------------------------------------------- farm-gallery
drop policy if exists "Logged in users can upload to gallery" on storage.objects;
drop policy if exists "Users can upload farm gallery images" on storage.objects;
drop policy if exists "Restrict file size farm gallery" on storage.objects;
drop policy if exists "Users can delete own farm gallery images" on storage.objects;

create policy "users upload farm gallery images to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'farm-gallery' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "users delete own farm gallery images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'farm-gallery' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- -------------------------------------------------------- community-posts
drop policy if exists "Logged in users can upload community images" on storage.objects;
drop policy if exists "Restrict file size community posts" on storage.objects;

create policy "users upload community images to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'community-posts' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ------------------------------------------------------------ bucket limits
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id in ('avatars', 'farm-gallery', 'community-posts');

-- ------------------------------------------------- farmer verification
create or replace function public.protect_farmer_verified()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_app_admin() then
    if tg_op = 'INSERT' then
      new.verified := false;
    elsif new.verified is distinct from old.verified then
      new.verified := old.verified;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_farmer_verified on public.farmer_profiles;
create trigger trg_protect_farmer_verified
  before insert or update on public.farmer_profiles
  for each row execute function public.protect_farmer_verified();

create policy "admin can update farmer verification" on public.farmer_profiles
  for update to authenticated
  using ((select public.is_app_admin()))
  with check ((select public.is_app_admin()));
