create policy "vet and farmer can view their own lab result files"
  on storage.objects for select
  using (
    bucket_id = 'lab-results'
    and exists (
      select 1 from public.vet_medical_records r
      where r.file_path = storage.objects.name
        and (
          r.vet_id = (select auth.uid()) or r.vet_email = coalesce((select auth.email()), (select auth.jwt() ->> 'phone'))
          or r.farmer_id = (select auth.uid()) or r.farmer_email = coalesce((select auth.email()), (select auth.jwt() ->> 'phone'))
        )
    )
  );

create policy "vets can upload lab result files" on storage.objects
  for insert
  with check (bucket_id = 'lab-results' and (select auth.uid()) is not null);
