-- Security checks for the supplier dashboard and the community group,
-- run against the linked database.
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
  sp_a uuid; sp_b uuid; prod_a uuid; hidden_a uuid; msg_f uuid; msg_a uuid;
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

  -- ============================ community group chat ==================
  -- still acting as the farmer
  insert into public.community_chat (user_email, user_name, message)
    values (email_f, 'Site Admin', '  sec-test hello, which feed is Better for layers?  ') returning id into msg_f;
  select (user_email = email_f and message = 'sec-test hello, which feed is Better for layers?'
          and user_name <> 'Site Admin' and sender_badge is null) into b
    from public.community_chat where id = msg_f;
  if coalesce(b, false) then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL C1 message not cleaned, or sender chose own name/badge; '; end if;

  insert into public.community_chat (user_email, user_name, message) values (email_a, 'x', 'sec-test spoof');
  select count(*) into n from public.community_chat where message = 'sec-test spoof' and user_email = email_a;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL C2 posted as another member; '; end if;

  begin
    insert into public.community_chat (user_email, user_name, message) values (email_f, 'x', 'Join our BETTING group today');
    failed := failed + 1; report := report || 'FAIL C3 blocked word accepted; ';
  exception when raise_exception then
    if sqlerrm = 'community_blocked' then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL C3 wrong error %s; ', sqlerrm); end if;
  end;

  begin
    update public.community_chat set message = 'edited' where id = msg_f;
    get diagnostics n = row_count;
    if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL C4 member rewrote a message directly; '; end if;
  exception when insufficient_privilege then passed := passed + 1;
  end;

  begin
    delete from public.community_chat where id = msg_f;
    get diagnostics n = row_count;
    if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL C5 member hard-deleted a message; '; end if;
  exception when insufficient_privilege then passed := passed + 1;
  end;

  insert into public.message_reactions (message_id, user_email, user_name, emoji) values (msg_f, email_f, 'x', '👍');
  begin
    insert into public.message_reactions (message_id, user_email, user_name, emoji) values (msg_f, email_f, 'x', '❤️');
    failed := failed + 1; report := report || 'FAIL C6 two reactions from one person on one message; ';
  exception when unique_violation then passed := passed + 1;
  end;

  insert into public.message_reactions (message_id, user_email, user_name, emoji) values (msg_f, email_f, 'x', '🙏')
    on conflict (message_id, user_email) do update set emoji = excluded.emoji;
  select count(*), max(emoji) into n, v from public.message_reactions where message_id = msg_f and user_email = email_f;
  if n = 1 and v = '🙏' then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL C7 changing a reaction did not replace it; '; end if;

  -- another member
  perform set_config('request.jwt.claims', claims_b, true);

  begin
    perform public.community_remove_message(msg_f);
    failed := failed + 1; report := report || 'FAIL C8 member removed a message that is not theirs; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  insert into public.community_reports (message_id, reporter, reason) values (msg_f, email_b, 'sec-test report');
  begin
    insert into public.community_reports (message_id, reporter, reason) values (msg_f, email_a, 'as someone else');
    failed := failed + 1; report := report || 'FAIL C9 report filed in another member name; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  begin
    insert into public.community_mutes (user_email, muted_until) values (email_f, now() + interval '1 day');
    failed := failed + 1; report := report || 'FAIL C10 member muted another member; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  select count(*) into n from public.community_blocked_terms;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL C11 member read the blocked-word list; '; end if;

  -- a third member cannot see the report
  perform set_config('request.jwt.claims', claims_a, true);
  select count(*) into n from public.community_reports where message_id = msg_f;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL C12 member read a report filed by someone else; '; end if;

  -- sending too fast: the 9th message inside a minute is refused
  for i in 1..8 loop
    insert into public.community_chat (user_email, user_name, message) values (email_a, 'x', 'sec-test burst ' || i);
  end loop;
  begin
    insert into public.community_chat (user_email, user_name, message) values (email_a, 'x', 'sec-test burst 9');
    failed := failed + 1; report := report || 'FAIL C13 no rate limit; ';
  exception when raise_exception then
    if sqlerrm = 'community_too_fast' then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL C13 wrong error %s; ', sqlerrm); end if;
  end;

  -- an admin (app_metadata, not self-declared) removes a member message
  select id into msg_a from public.community_chat where message = 'sec-test burst 1' and user_email = email_a;
  perform set_config('request.jwt.claims', json_build_object('sub', sup_b, 'email', email_b, 'phone', '', 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin'))::text, true);
  select public.community_remove_message(msg_a) into b;
  select count(*) into n from public.community_chat where id = msg_a and message = '' and removed_by = 'admin';
  if b and n = 1 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL C14 admin could not remove a message; '; end if;

  insert into public.community_mutes (user_email, muted_until, reason) values (email_f, now() + interval '1 day', 'sec-test');

  -- the author removes their own message; its reactions and the open report go too
  perform set_config('request.jwt.claims', claims_f, true);
  select public.community_remove_message(msg_f) into b;
  select count(*) into n from public.message_reactions where message_id = msg_f;
  select removed_by into v from public.community_chat where id = msg_f;
  if b and n = 0 and v = 'author' then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL C15 author could not remove own message; '; end if;

  -- and, being muted now, cannot post
  begin
    insert into public.community_chat (user_email, user_name, message) values (email_f, 'x', 'sec-test while muted');
    failed := failed + 1; report := report || 'FAIL C16 muted member posted; ';
  exception when raise_exception then
    if sqlerrm = 'community_muted' then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL C16 wrong error %s; ', sqlerrm); end if;
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

  begin
    select count(*) into n from public.community_chat;
    if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL A4 anonymous user read the community; '; end if;
  exception when insufficient_privilege then passed := passed + 1;
  end;

  reset role;
  raise exception 'SECURITY_TESTS passed=% failed=% :: %', passed, failed, coalesce(nullif(report, ''), 'all checks passed');
end $$;

rollback;
