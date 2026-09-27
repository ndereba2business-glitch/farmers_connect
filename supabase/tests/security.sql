-- Supplier dashboard security checks, run against the linked database.
--
--   npm run test:security
--
-- Everything happens inside one transaction that always ends in an error,
-- so it rolls back and leaves no data behind. It borrows three existing
-- accounts (two acting as suppliers, one farmer with a farmer profile) and
-- impersonates them by setting JWT claims, exactly as PostgREST does.
-- The final error message carries the results; scripts/test-security.mjs
-- parses it and exits non-zero if anything failed.

begin;

do $$
declare
  sup_a uuid; email_a text; sup_b uuid; email_b text; farmer uuid; email_f text; farmer_profile uuid;
  sp_a uuid; sp_b uuid; prod_a uuid; hidden_a uuid;
  claims_a text; claims_b text; claims_f text;
  n int; v text; b boolean;
  passed int := 0; failed int := 0; report text := '';
begin
  select u.id, u.email, f.id into farmer, email_f, farmer_profile
    from auth.users u join public.farmer_profiles f on f.user_email = u.email
   where coalesce(u.email, '') <> '' order by u.created_at limit 1;
  -- accounts that aren't real suppliers, so the fixtures don't collide
  select id, email into sup_a, email_a from auth.users u
   where coalesce(email, '') <> '' and id <> farmer
     and not exists (select 1 from public.supplier_profiles sp where sp.user_id = u.id)
   order by created_at limit 1;
  select id, email into sup_b, email_b from auth.users u
   where coalesce(email, '') <> '' and id not in (farmer, sup_a)
     and not exists (select 1 from public.supplier_profiles sp where sp.user_id = u.id)
   order by created_at limit 1;
  if farmer is null or sup_a is null or sup_b is null then
    raise exception 'SECURITY_TESTS setup failed: need 3 email accounts, one with a farmer profile';
  end if;

  claims_a := json_build_object('sub', sup_a, 'email', email_a, 'phone', '', 'role', 'authenticated')::text;
  claims_b := json_build_object('sub', sup_b, 'email', email_b, 'phone', '', 'role', 'authenticated')::text;
  claims_f := json_build_object('sub', farmer, 'email', email_f, 'phone', '', 'role', 'authenticated')::text;

  -- fixtures (as the database owner): two suppliers, A's products
  insert into public.supplier_profiles (user_id, business_name, verification_status) values (sup_a, 'sec-test A', 'verified') returning id into sp_a;
  insert into public.supplier_profiles (user_id, business_name, verification_status) values (sup_b, 'sec-test B', 'verified') returning id into sp_b;
  insert into public.products (product_name, category, price, unit, user_email, supplier_id)
    values ('sec-test product', 'feeds', 1000, 'per_bag', email_a, sp_a) returning id into prod_a;
  insert into public.products (product_name, category, price, unit, user_email, supplier_id, is_active)
    values ('sec-test hidden', 'feeds', 1000, 'per_bag', email_a, sp_a, false) returning id into hidden_a;

  -- ============================ as supplier B (another supplier) ======
  perform set_config('request.jwt.claims', claims_b, true);
  set local role authenticated;

  update public.products set price = 1 where id = prod_a;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL S1 other supplier edited a product; '; end if;

  update public.products set availability = 'out_of_stock' where id = prod_a;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL S2 other supplier changed availability; '; end if;

  delete from public.products where id = prod_a;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL S3 other supplier deleted a product; '; end if;

  update public.supplier_profiles set business_name = 'hacked' where id = sp_a;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL S4 other supplier edited a profile; '; end if;

  begin
    insert into public.products (product_name, category, price, user_email, supplier_id) values ('imposter', 'feeds', 10, email_b, sp_a);
    failed := failed + 1; report := report || 'FAIL S5 listed under another supplier profile; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  begin
    insert into public.products (product_name, category, price, user_email) values ('imposter', 'feeds', 10, email_a);
    failed := failed + 1; report := report || 'FAIL S6 listed under another user''s identity; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  select count(*) into n from public.products where id = hidden_a;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL S7 other supplier saw an inactive product; '; end if;

  begin
    insert into storage.objects (bucket_id, name, owner) values ('marketplace-images', sup_a::text || '/x.jpg', sup_b);
    failed := failed + 1; report := report || 'FAIL S8 uploaded into another user''s folder; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  -- ============================ as supplier A (the owner) =============
  perform set_config('request.jwt.claims', claims_a, true);

  update public.products set price = 1200 where id = prod_a;
  get diagnostics n = row_count;
  if n = 1 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL S9 owner could not edit own product; '; end if;

  select count(*) into n from public.products where id = hidden_a;
  if n = 1 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL S10 owner could not see own inactive product; '; end if;

  update public.supplier_profiles set verification_status = 'verified', business_name = 'sec-test A2' where id = sp_a;
  update public.supplier_profiles set verification_status = 'suspended' where id = sp_a;
  select verification_status into v from public.supplier_profiles where id = sp_a;
  if v = 'verified' then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL S11 supplier changed own verification to %s; ', v); end if;

  update public.products set is_verified = true where id = prod_a;
  select is_verified into b from public.products where id = prod_a;
  if not coalesce(b, false) then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL S12 supplier verified own product; '; end if;

  begin
    update public.products set price = 0 where id = prod_a;
    failed := failed + 1; report := report || 'FAIL S13 price 0 accepted; ';
  exception when check_violation then passed := passed + 1;
  end;

  -- a brand-new supplier can't start out verified
  reset role;
  delete from public.supplier_profiles where id = sp_b;
  perform set_config('request.jwt.claims', claims_b, true);
  set local role authenticated;
  insert into public.supplier_profiles (user_id, business_name, verification_status) values (sup_b, 'sec-test B2', 'verified');
  select verification_status into v from public.supplier_profiles where user_id = sup_b;
  if v = 'pending' then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL S14 new supplier started as %s; ', v); end if;

  -- ============================ as a farmer ===========================
  perform set_config('request.jwt.claims', claims_f, true);

  select count(*) into n from public.products where id = prod_a;
  if n = 1 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL F1 farmer could not see an active listing; '; end if;

  select count(*) into n from public.products where id = hidden_a;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL F2 farmer saw an inactive listing; '; end if;

  update public.products set price = 1 where id = prod_a;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL F3 farmer edited a supplier product; '; end if;

  delete from public.products where id = prod_a;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL F4 farmer deleted a supplier product; '; end if;

  update public.farmer_profiles set verified = true where id = farmer_profile;
  select verified::text into v from public.farmer_profiles where id = farmer_profile;
  if v = 'false' then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL F5 farmer verified themselves; '; end if;

  insert into public.contact_events (product_id, channel) values (prod_a, 'whatsapp');
  begin
    perform 1 from public.contact_events;
    failed := failed + 1; report := report || 'FAIL F6 contact rows readable; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  begin
    perform * from public.admin_contact_stats(30);
    failed := failed + 1; report := report || 'FAIL F7 non-admin read platform stats; ';
  exception when others then passed := passed + 1;
  end;

  -- ============================ anonymous (not signed in) =============
  reset role;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;

  -- "no rows" and "permission denied" both mean nothing leaked
  begin
    select count(*) into n from public.products;
    if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL A1 anonymous user read products; '; end if;
  exception when insufficient_privilege then passed := passed + 1;
  end;

  begin
    insert into public.products (product_name, category, price, user_email) values ('anon', 'feeds', 10, '');
    failed := failed + 1; report := report || 'FAIL A2 anonymous user created a product; ';
  exception when insufficient_privilege or check_violation then passed := passed + 1;
  end;

  begin
    select count(*) into n from public.supplier_profiles;
    if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL A3 anonymous user read supplier profiles; '; end if;
  exception when insufficient_privilege then passed := passed + 1;
  end;

  reset role;
  raise exception 'SECURITY_TESTS passed=% failed=% :: %', passed, failed, coalesce(nullif(report, ''), 'all checks passed');
end $$;

rollback;
