-- Three gaps found by the release security review.
--
-- 1. Anyone on the internet could LIST every photograph.
--    The four photo buckets (avatars, farm-gallery, marketplace-images,
--    community-posts) each had a read rule on storage.objects granted to
--    `public`, which includes visitors who are not signed in. A public
--    bucket already lets a file be fetched by anyone who has its exact
--    address; that is how photos are shown and it does not need a rule. What
--    the rule added was the ability to ASK FOR THE LIST: with nothing but
--    the app's public key, a visitor could enumerate every farmer's
--    gallery photos, which the app treats as private to their owner.
--    Checked from outside before this migration: 8 gallery files, 5
--    avatars, 5 listing photos and 1 community photo were listed to a
--    request with no sign-in.
--
--    Now a signed-in person can list and manage only the files in their
--    own folder (which is what deleting a photo needs), and a visitor can
--    list nothing. Showing a photo by its address works exactly as before.
--
-- 2. Lab-result files had no size or type limit.
--    A verified vet could upload any kind of file of any size the project
--    allows. Limited to 10 MB and to PDF or an image, which is what a lab
--    report is.
--
-- 3. A new account could inherit an old profile.
--    Profiles are keyed by the account's email or phone number. If an
--    account was ever removed in the Supabase dashboard, its profile row
--    stayed, and the next sign-up with the same address was handed it:
--    name, phone number and county of whoever had the address before.
--    Email addresses are not confirmed at sign-up today, so that next
--    person need not be the same one. The sign-up trigger now clears any
--    such leftover first. (Accounts deleted through the app leave nothing
--    behind: see delete_account_data.)

-- ---------------------------------------------------------------------
-- 1. Listing files
-- ---------------------------------------------------------------------
drop policy if exists "Anyone can view avatars" on storage.objects;
drop policy if exists "Anyone can view community post images" on storage.objects;
drop policy if exists "Anyone can view farm gallery images" on storage.objects;
drop policy if exists "Anyone can view marketplace images" on storage.objects;

drop policy if exists "people list their own photo files" on storage.objects;
create policy "people list their own photo files" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('avatars', 'farm-gallery', 'marketplace-images', 'community-posts')
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  );

-- ---------------------------------------------------------------------
-- 2. Lab results: a report, not anything at all
-- ---------------------------------------------------------------------
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
 where id = 'lab-results';

-- ---------------------------------------------------------------------
-- 3. A new account starts with a new profile
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ident text := coalesce(nullif(new.email, ''), nullif(new.phone, ''));
begin
  if ident is null then
    return new;
  end if;
  begin
    -- No two accounts share an email or phone number, so a profile that
    -- already exists for this one belonged to an account that is gone.
    delete from public.farmer_profiles where user_email = ident;

    insert into public.farmer_profiles (user_email, full_name, country_code)
    values (
      ident,
      coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
               nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
               'Farmer'),
      '+254')
    on conflict (user_email) do nothing;
  exception when others then
    raise warning 'handle_new_user: no profile created for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
