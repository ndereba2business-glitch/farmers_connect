-- Security checks for the supplier dashboard, Clucky, notifications and the community group,
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
  msg_n uuid; reply_n uuid; appt_n uuid; batch_n uuid; list_f uuid; list_g uuid;
  gone uuid; email_gone text := 'sec-test-leaving@example.test'; claims_gone text; gone_msg uuid; gone_reply uuid;
  gone_batch uuid; gone_sp uuid; gone_prod uuid; gone_rec uuid; res jsonb; admin_id uuid;
  claims_a text; claims_b text; claims_f text;
  n int; i int; v text; b boolean; rec record;
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

  -- ============================ Clucky AI conversations ================
  -- only the edge function (service role) writes; people read and clear their own
  reset role;
  insert into public.clucky_messages (user_email, role, content)
    values (email_f, 'user', 'sec-test my question'), (email_a, 'user', 'sec-test their question');
  perform set_config('request.jwt.claims', claims_f, true);
  set local role authenticated;

  begin
    insert into public.clucky_messages (user_email, role, content) values (email_f, 'assistant', 'sec-test forged answer');
    failed := failed + 1; report := report || 'FAIL K1 member wrote a Clucky message directly; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  select count(*) filter (where user_email = email_f), count(*) filter (where user_email <> email_f) into n, i
    from public.clucky_messages where content like 'sec-test%';
  if n = 1 and i = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL K2 Clucky conversations not private; '; end if;

  begin
    update public.clucky_messages set content = 'edited' where user_email = email_f;
    failed := failed + 1; report := report || 'FAIL K3 member edited Clucky history; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  delete from public.clucky_messages;
  reset role;
  select count(*) filter (where user_email = email_f), count(*) filter (where user_email = email_a) into n, i
    from public.clucky_messages where content like 'sec-test%';
  if n = 0 and i = 1 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL K4 clearing a chat touched the wrong rows; '; end if;

  -- the daily allowance: counted apart from the chat, so clearing the chat
  -- (which the farmer just did above) cannot reset it
  delete from public.clucky_usage where user_id = farmer;
  b := public.clucky_take_question(farmer, 2) and public.clucky_take_question(farmer, 2);
  if b and not public.clucky_take_question(farmer, 2) then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL K5 Clucky daily limit not enforced; '; end if;
  select questions into n from public.clucky_usage where user_id = farmer;
  if n = 2 then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL K6 a refused question was still counted (%s); ', n); end if;
  perform public.clucky_refund_question(farmer);
  if public.clucky_take_question(farmer, 2) then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL K7 a refunded question was not given back; '; end if;
  perform public.clucky_refund_question(farmer); perform public.clucky_refund_question(farmer); perform public.clucky_refund_question(farmer);
  select questions into n from public.clucky_usage where user_id = farmer;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL K8 refunds went below zero or were lost (%s); ', n); end if;
  perform public.clucky_take_question(farmer, 2);

  perform set_config('request.jwt.claims', claims_f, true);
  set local role authenticated;
  begin
    select count(*) into n from public.clucky_usage;
    if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL K9 member read Clucky usage counts; '; end if;
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    update public.clucky_usage set questions = 0 where user_id = farmer;
    get diagnostics n = row_count;
    if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL K10 member reset their own Clucky allowance; '; end if;
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    perform public.clucky_refund_question(farmer);
    failed := failed + 1; report := report || 'FAIL K11 member refunded themselves a Clucky question; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    perform public.clucky_take_question(sup_a, 1);
    failed := failed + 1; report := report || 'FAIL K12 member used up another account''s Clucky allowance; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;
  reset role;

  -- usage figures for deciding about the paid tier: recorded by the
  -- function, read only by an admin, and only as counts
  delete from public.clucky_service_days;
  perform public.clucky_record_answer(farmer, 900, 60);
  perform public.clucky_record_answer(farmer, 1100, -5);
  select input_tokens, output_tokens into n, i from public.clucky_usage where user_id = farmer;
  if n = 2000 and i = 60 then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL K13 answer cost not recorded (%s in, %s out); ', n, i); end if;
  perform public.clucky_record_service_event('quota');
  perform public.clucky_record_service_event('quota');
  perform public.clucky_record_service_event('failure');
  select quota_hits, failures into n, i from public.clucky_service_days;
  select (last_quota_hit > now() - interval '1 minute') and questions_today >= 1 into b from public.clucky_day_state();
  if n = 2 and i = 1 and coalesce(b, false) then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL K14 service refusals not recorded; '; end if;

  perform set_config('request.jwt.claims', claims_f, true);
  set local role authenticated;
  begin
    select count(*) into n from public.clucky_service_days;
    if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL K15 member read Clucky service records; '; end if;
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    perform public.clucky_record_answer(farmer, 1, 1);
    failed := failed + 1; report := report || 'FAIL K16 member wrote Clucky usage figures; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    perform public.clucky_record_service_event('quota');
    failed := failed + 1; report := report || 'FAIL K17 member could switch Clucky off for everyone; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    perform * from public.clucky_usage_summary(7);
    failed := failed + 1; report := report || 'FAIL K18 member read Clucky usage summary; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  -- an admin (app_metadata, not self-declared) reads the summary
  perform set_config('request.jwt.claims', json_build_object('sub', sup_a, 'email', email_a, 'phone', '', 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin'))::text, true);
  select count(*) into i from public.clucky_usage_summary(7);
  select s.questions >= 1 and s.people >= 1 and s.input_tokens >= 2000 and s.output_tokens >= 60 and s.quota_hits = 2 and s.failures = 1 into b
    from public.clucky_usage_summary(7) s order by s.day desc limit 1;
  if i = 7 and coalesce(b, false) then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL K19 admin summary wrong (%s days); ', i); end if;

  -- calling yourself an admin in user_metadata changes nothing
  perform set_config('request.jwt.claims', json_build_object('sub', sup_b, 'email', email_b, 'phone', '', 'role', 'authenticated',
    'user_metadata', json_build_object('role', 'admin'))::text, true);
  begin
    perform * from public.clucky_usage_summary(7);
    failed := failed + 1; report := report || 'FAIL K20 self-declared admin read Clucky usage summary; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;
  reset role;
  perform set_config('request.jwt.claims', claims_f, true);
  set local role authenticated;

  -- ============================ notifications ==========================
  -- still acting as the farmer; make sure the borrowed account has them on
  update public.farmer_profiles set notifications_enabled = true where id = farmer_profile;

  begin
    insert into public.notifications (user_email, type, title, message) values (email_a, 'general', 'sec-test', 'for someone else');
    failed := failed + 1; report := report || 'FAIL N1 wrote a notification into another inbox; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  begin
    perform public.push_notification(email_a, 'general', 'sec-test', 'direct call');
    failed := failed + 1; report := report || 'FAIL N2 member called push_notification; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  insert into public.community_chat (user_email, user_name, message) values (email_f, 'x', 'sec-test notify me') returning id into msg_n;

  -- another member replies and reacts
  perform set_config('request.jwt.claims', claims_b, true);
  insert into public.community_chat (user_email, user_name, message, reply_to_id) values (email_b, 'x', 'sec-test a reply', msg_n) returning id into reply_n;
  insert into public.message_reactions (message_id, user_email, user_name, emoji) values (msg_n, email_b, 'x', '👍');
  update public.message_reactions set emoji = '🔥' where message_id = msg_n and user_email = email_b;
  select count(*) into n from public.notifications where user_email = email_f;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL N3 member read another inbox; '; end if;

  begin
    insert into public.notification_preferences (user_email, community) values (email_f, false);
    failed := failed + 1; report := report || 'FAIL N4 member changed another member preferences; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  -- back to the farmer: exactly one notification each for the reply and the reaction
  perform set_config('request.jwt.claims', claims_f, true);
  select count(*) into n from public.notifications where user_email = email_f and dedupe_key = 'reply:' || reply_n and category = 'community';
  if n = 1 then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL N5 reply produced %s notifications; ', n); end if;

  select count(*) into n from public.notifications where user_email = email_f and dedupe_key like 'react:' || msg_n || ':%';
  if n = 1 then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL N6 reaction (then changed) produced %s notifications; ', n); end if;

  -- clearing hides it without deleting, and only in my own inbox
  update public.notifications set cleared_at = now(), read = true where user_email = email_f and dedupe_key = 'reply:' || reply_n;
  get diagnostics n = row_count;
  if n = 1 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL N7 could not clear own notification; '; end if;

  -- community switched off: the next reply is not announced
  insert into public.notification_preferences (user_email, community) values (email_f, false)
    on conflict (user_email) do update set community = false;
  perform set_config('request.jwt.claims', claims_b, true);
  insert into public.community_chat (user_email, user_name, message, reply_to_id) values (email_b, 'x', 'sec-test second reply', msg_n) returning id into reply_n;
  perform set_config('request.jwt.claims', claims_f, true);
  select count(*) into n from public.notifications where user_email = email_f and dedupe_key = 'reply:' || reply_n;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL N8 notified although community is switched off; '; end if;

  -- reminders: many overdue vaccinations become one line, and running it twice adds nothing
  reset role;
  insert into public.farm_batches (user_email, batch_name, batch_type, status, hatch_date, quantity, current_count)
    values (email_f, 'sec-test batch', 'broiler', 'active', current_date - 30, 50, 50) returning id into batch_n;
  insert into public.vaccination_tasks (batch_id, user_email, vaccine_name, day_number, scheduled_date, completed)
    values (batch_n, email_f, 'sec-test NCD', 7, current_date - 20, false),
           (batch_n, email_f, 'sec-test Gumboro', 14, current_date - 14, false),
           (batch_n, email_f, 'sec-test IB', 21, current_date - 7, false);
  insert into public.vet_appointments (farmer_email, vet_email, farm_name, appointment_date, status)
    values (email_f, email_a, 'sec-test farm', current_date + 1, 'pending') returning id into appt_n;
  update public.vet_appointments set status = 'accepted' where id = appt_n;
  perform set_config('request.jwt.claims', claims_f, true);
  set local role authenticated;

  perform public.sync_my_reminders();
  perform public.sync_my_reminders();
  select count(*), max(title) into n, v from public.notifications where user_email = email_f and dedupe_key like 'vacc-overdue:%';
  if n = 1 and v like '%vaccinations are overdue' then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL N9 overdue reminders: %s rows, title %s; ', n, v); end if;

  select count(*) into n from public.notifications where user_email = email_f and dedupe_key = 'appt:' || appt_n || ':accepted';
  if n = 1 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL N10 farmer not told the visit was accepted; '; end if;

  select count(*) into n from public.notifications where user_email = email_f and dedupe_key like 'appt-soon:' || appt_n || ':%';
  if n = 1 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL N11 no reminder for the visit tomorrow; '; end if;

  -- master switch off: nothing at all, including account notices
  update public.farmer_profiles set notifications_enabled = false where id = farmer_profile;
  select count(*) into n from public.notifications where user_email = email_f;
  insert into public.notifications (user_email, type, title, message) values (email_f, 'general', 'sec-test', 'while off');
  select count(*) - n into n from public.notifications where user_email = email_f;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL N12 notified although notifications are off; '; end if;
  update public.farmer_profiles set notifications_enabled = true where id = farmer_profile;

  -- the vet was told about the request, in their own inbox
  perform set_config('request.jwt.claims', claims_a, true);
  select count(*) into n from public.notifications where user_email = email_a and dedupe_key = 'appt-new:' || appt_n;
  if n = 1 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL N13 vet not told about the visit request; '; end if;

  -- a request addressed to a vet by account id (how the booking form
  -- sends it) reaches that vet too
  reset role;
  insert into public.vet_appointments (farmer_email, requested_vet_id, farm_name, appointment_date, status)
    values (email_f, sup_b, 'sec-test farm 2', current_date + 3, 'pending') returning id into appt_n;
  perform set_config('request.jwt.claims', claims_b, true);
  set local role authenticated;
  select count(*) into n from public.notifications where user_email = email_b and dedupe_key = 'appt-new:' || appt_n;
  if n = 1 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL N15 requested vet not told about the visit request; '; end if;
  perform set_config('request.jwt.claims', claims_a, true);

  -- the supplier was told a farmer got in touch (check F6 above), but not who
  select count(*), bool_or(message like '%' || email_f || '%') into n, b
    from public.notifications where user_email = email_a and dedupe_key like 'contact:' || prod_a || ':%';
  if n = 1 and not b then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL N14 supplier contact notification: %s rows; ', n); end if;

  perform set_config('request.jwt.claims', claims_f, true);

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

  -- ============================ hardening (2026-10 review) =============
  -- sup_b plays a verified vet for these checks. Set up as the database
  -- owner with no signed-in user, or the self-verification guards would
  -- (rightly) turn "verified" back into "pending".
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if exists (select 1 from public.vet_profiles where user_id = sup_b) then
    update public.vet_profiles set verification_status = 'verified', email = email_b where user_id = sup_b;
  else
    insert into public.vet_profiles (user_id, full_name, email, verification_status) values (sup_b, 'sec-test vet', email_b, 'verified');
  end if;
  insert into public.vet_questions (user_email, question, is_emergency, status)
    values (email_f, 'sec-test birds dying fast', true, 'pending') returning id into msg_a;
  perform set_config('request.jwt.claims', claims_f, true);
  set local role authenticated;

  -- a farmer cannot pose as a vet to another farmer
  begin
    insert into public.vet_farmer_messages (vet_email, farmer_email, sender_email, message) values (email_f, email_a, email_f, 'sec-test I am your vet');
    failed := failed + 1; report := report || 'FAIL H1 farmer messaged another farmer as their vet; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  -- but can write to a verified vet
  insert into public.vet_farmer_messages (vet_email, farmer_email, sender_email, message) values (email_b, email_f, email_f, 'sec-test hello doctor');
  select count(*) into n from public.vet_farmer_messages where message = 'sec-test hello doctor';
  if n = 1 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL H2 farmer could not message a verified vet; '; end if;

  -- a farmer cannot write a finished visit onto someone else's record
  begin
    insert into public.vet_appointments (farmer_email, vet_email, vet_id, farm_name, appointment_date, status, fee)
      values (email_a, email_f, farmer, 'sec-test', current_date, 'completed', 99999);
    failed := failed + 1; report := report || 'FAIL H3 farmer created a completed visit as the vet; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  -- nor ask for a visit that is already accepted or priced
  begin
    insert into public.vet_appointments (farmer_email, farmer_id, farm_name, appointment_date, status, fee)
      values (email_f, farmer, 'sec-test', current_date + 5, 'accepted', 0);
    failed := failed + 1; report := report || 'FAIL H4 farmer created a pre-accepted visit; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  -- an ordinary request still works
  insert into public.vet_appointments (farmer_email, farmer_id, requested_vet_id, farm_name, appointment_date, status)
    values (email_f, farmer, sup_b, 'sec-test farm 3', current_date + 5, 'pending') returning id into appt_n;

  -- only verified vets, in their own folder, may add lab results
  begin
    insert into storage.objects (bucket_id, name, owner) values ('lab-results', farmer::text || '/sec-test.pdf', farmer);
    failed := failed + 1; report := report || 'FAIL H5 non-vet uploaded a lab result; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  -- the vet
  perform set_config('request.jwt.claims', claims_b, true);

  -- as the app does: claim the request, then decline it
  update public.vet_appointments set vet_id = sup_b, vet_email = email_b where id = appt_n and vet_id is null;
  update public.vet_appointments set status = 'rejected', rejection_reason = 'sec-test fully booked' where id = appt_n;
  select status into v from public.vet_appointments where id = appt_n;
  if v = 'rejected' then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL H6 vet could not decline a visit (status %s); ', v); end if;

  begin
    update public.vet_appointments set status = 'accepted' where id = appt_n;
    failed := failed + 1; report := report || 'FAIL H7 a declined visit was reopened; ';
  exception when raise_exception then passed := passed + 1;
  end;

  -- the vet can reply to the farmer who wrote first
  insert into public.vet_farmer_messages (vet_id, vet_email, farmer_email, sender_email, message) values (sup_b, email_b, email_f, email_b, 'sec-test reply');
  select count(*) into n from public.vet_farmer_messages where message = 'sec-test reply';
  if n = 1 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL H8 vet could not reply to a farmer; '; end if;

  -- answering an emergency keeps the question and its owner intact
  update public.vet_questions set answer = 'sec-test isolate them', status = 'answered', user_email = email_b, question = 'rewritten' where id = msg_a;
  select (answer = 'sec-test isolate them' and user_email = email_f and question = 'sec-test birds dying fast') into b from public.vet_questions where id = msg_a;
  if coalesce(b, false) then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL H9 vet answer did not save, or rewrote the question; '; end if;

  begin
    insert into storage.objects (bucket_id, name, owner) values ('lab-results', farmer::text || '/sec-test.pdf', sup_b);
    failed := failed + 1; report := report || 'FAIL H10 vet uploaded outside own folder; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  insert into storage.objects (bucket_id, name, owner) values ('lab-results', sup_b::text || '/sec-test.pdf', sup_b);
  passed := passed + 1;

  -- an anonymous session (no account) gets nothing and can do nothing.
  -- (sup_b's id, so it is not the owner of the product it tries to contact:
  -- owners tapping their own listing are skipped before any rule runs.)
  perform set_config('request.jwt.claims',
    json_build_object('sub', sup_b, 'email', '', 'phone', '', 'role', 'authenticated', 'is_anonymous', true)::text, true);
  select (select count(*) from public.community_chat) + (select count(*) from public.supplier_profiles)
       + (select count(*) from public.products) + (select count(*) from public.vet_profiles) into n;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL H11 anonymous session read %s rows; ', n); end if;

  begin
    insert into public.contact_events (product_id, channel) values (prod_a, 'call');
    failed := failed + 1; report := report || 'FAIL H12 anonymous session recorded a contact; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  begin
    insert into storage.objects (bucket_id, name, owner) values ('avatars', sup_b::text || '/sec-test.jpg', sup_b);
    failed := failed + 1; report := report || 'FAIL H13 anonymous session uploaded a file; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  -- structure: every table is locked the same way
  reset role;
  select count(*) into n from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
     and (not c.relrowsecurity
          or not exists (select 1 from pg_policy p where p.polrelid = c.oid and p.polname = 'block_anonymous_sessions')
          or has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert'));
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL H14 %s table(s) without row-level security, the anonymous-session rule, or still open to visitors; ', n); end if;

  select count(*) into n from pg_proc p
   where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute');
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL H15 %s function(s) callable without signing in; ', n); end if;

  -- a phone sign-up gets a profile under its phone number, not a blank one
  begin
    insert into auth.users (id, instance_id, aud, role, phone, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
      values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '254700000999',
              '{"full_name": "sec-test phone farmer"}', '{}', now(), now());
    select count(*) into n from public.farmer_profiles where user_email = '254700000999' and full_name = 'sec-test phone farmer';
    select count(*) into i from public.farmer_profiles where coalesce(user_email, '') = '';
    if n = 1 and i = 0 then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL H16 phone sign-up profile: %s named, %s blank; ', n, i); end if;
  exception when others then
    failed := failed + 1; report := report || format('FAIL H16 could not simulate a sign-up: %s; ', sqlerrm);
  end;

  -- a new account never inherits the profile of whoever had the address before
  begin
    insert into public.farmer_profiles (user_email, full_name, phone, county)
      values ('sec-test-reused@example.test', 'sec-test previous person', '0700000000', 'Nakuru');
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
      values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sec-test-reused@example.test',
              '{"full_name": "sec-test new person"}', '{}', now(), now());
    select count(*) into n from public.farmer_profiles where user_email = 'sec-test-reused@example.test';
    select count(*) into i from public.farmer_profiles
     where user_email = 'sec-test-reused@example.test' and full_name = 'sec-test new person' and phone is null and coalesce(county, '') = '';
    if n = 1 and i = 1 then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL H18 a new account inherited an old profile (%s rows, %s clean); ', n, i); end if;
  exception when others then
    failed := failed + 1; report := report || format('FAIL H18 could not simulate a sign-up over a leftover profile: %s; ', sqlerrm);
  end;

  -- files: a signed-in person lists their own folder and nobody else's
  perform set_config('request.jwt.claims', claims_f, true);
  set local role authenticated;
  insert into storage.objects (bucket_id, name, owner) values ('farm-gallery', farmer::text || '/sec-test-mine.jpg', farmer);
  select count(*) into n from storage.objects where bucket_id = 'farm-gallery' and name = farmer::text || '/sec-test-mine.jpg';
  select count(*) into i from storage.objects
   where bucket_id in ('avatars', 'farm-gallery', 'marketplace-images', 'community-posts')
     and (storage.foldername(name))[1] is distinct from farmer::text;
  if n = 1 and i = 0 then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL H19 file listing: own file seen %s, other people''s files listed %s; ', n, i); end if;
  reset role;

  -- and a visitor lists nothing at all
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  begin
    select count(*) into n from storage.objects where bucket_id in ('avatars', 'farm-gallery', 'marketplace-images', 'community-posts');
    if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL H20 a visitor listed %s photo file(s); ', n); end if;
  exception when insufficient_privilege then passed := passed + 1;
  end;
  reset role;

  perform set_config('request.jwt.claims', claims_f, true);
  set local role authenticated;

  -- removing default access must not lock real users out: a signed-in
  -- farmer can query every table (the rules decide which rows come back).
  -- Exceptions, closed on purpose: clucky_usage and clucky_service_days
  -- belong to the edge function alone, and contact_events is write-only, so
  -- nobody can read who contacted whom (check F6).
  n := 0;
  for rec in select c.relname from pg_class c
              where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname not in ('contact_events', 'clucky_usage', 'clucky_service_days') loop
    begin
      execute format('select count(*) from public.%I', rec.relname) into i;
    exception when insufficient_privilege then
      n := n + 1; report := report || format('(no access to %s) ', rec.relname);
    end;
  end loop;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL H17 signed-in user locked out of %s table(s); ', n); end if;

  -- ============================ removing a marketplace listing =========
  -- A farmer's own listing (no supplier profile) that another member has
  -- already contacted: the case that used to be impossible to delete.
  reset role;
  insert into public.products (product_name, category, price, unit, user_email)
    values ('sec-test farmer listing', 'chickens', 500, 'per_bird', email_f) returning id into list_f;
  insert into public.products (product_name, category, price, unit, user_email)
    values ('sec-test reported listing', 'chickens', 500, 'per_bird', email_f) returning id into list_g;

  perform set_config('request.jwt.claims', claims_b, true);
  set local role authenticated;
  insert into public.contact_events (product_id, channel) values (list_f, 'whatsapp');

  delete from public.products where id = list_f;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL L1 another member removed a listing that is not theirs; '; end if;

  -- an account that only calls itself an admin is not one
  perform set_config('request.jwt.claims', json_build_object('sub', sup_b, 'email', email_b, 'phone', '', 'role', 'authenticated',
    'user_metadata', json_build_object('role', 'admin'))::text, true);
  delete from public.products where id = list_g;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL L2 a self-declared admin removed a listing; '; end if;

  perform set_config('request.jwt.claims', claims_f, true);
  begin
    delete from public.products where id = list_f;
    get diagnostics n = row_count;
    if n = 1 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL L3 the owner could not remove their own listing; '; end if;
  exception when others then
    failed := failed + 1; report := report || format('FAIL L3 removing a contacted listing raised %s; ', sqlstate);
  end;

  reset role;
  select count(*) into n from public.contact_events where product_id = list_f;
  if n = 1 then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL L4 the contact record did not survive the listing (%s rows); ', n); end if;

  -- a real admin can take a listing down, and its owner is told (unless
  -- they have switched all notifications off)
  select not exists (select 1 from public.farmer_profiles p where p.user_email = email_f and p.notifications_enabled is false) into b;
  perform set_config('request.jwt.claims', json_build_object('sub', sup_b, 'email', email_b, 'phone', '', 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin'))::text, true);
  set local role authenticated;
  delete from public.products where id = list_g;
  get diagnostics n = row_count;
  if n = 1 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL L5 an admin could not remove a listing; '; end if;

  reset role;
  select count(*) into n from public.notifications where user_email = email_f and dedupe_key = 'product-removed:' || list_g;
  if n = (case when b then 1 else 0 end) then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL L6 owner notice after an admin removal: %s; ', n); end if;

  -- ============================ appearance (light / dark) ==============
  -- a person sets their own theme, only to a value the app knows, and
  -- nobody else's
  perform set_config('request.jwt.claims', claims_f, true);
  set local role authenticated;
  update public.farmer_profiles set theme_preference = 'dark' where id = farmer_profile;
  get diagnostics n = row_count;
  if n = 1 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL T1 a member could not save their own theme; '; end if;
  begin
    update public.farmer_profiles set theme_preference = 'neon' where id = farmer_profile;
    failed := failed + 1; report := report || 'FAIL T2 an unknown theme was saved; ';
  exception when check_violation then passed := passed + 1;
  end;
  perform set_config('request.jwt.claims', claims_b, true);
  update public.farmer_profiles set theme_preference = 'light' where id = farmer_profile;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL T3 a member changed someone else''s theme; '; end if;

  -- ============================ reports, blocks and web requests =======
  perform set_config('request.jwt.claims', claims_b, true);
  set local role authenticated;

  insert into public.content_reports (kind, target_id, target_summary, reason) values ('listing', prod_a::text, 'sec-test product', 'sec-test misleading price');
  select count(*) into n from public.content_reports where reporter = email_b and kind = 'listing' and status = 'open';
  if n = 1 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL R1 a member could not report a listing; '; end if;

  begin
    insert into public.content_reports (kind, target_id, reason) values ('listing', prod_a::text, 'again');
    failed := failed + 1; report := report || 'FAIL R2 the same listing was reported twice by one member; ';
  exception when unique_violation then passed := passed + 1;
  end;

  begin
    insert into public.content_reports (kind, target_id, reporter, reason) values ('listing', hidden_a::text, email_a, 'as someone else');
    failed := failed + 1; report := report || 'FAIL R3 report filed in another member name; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  begin
    insert into public.content_reports (kind, target_id, reason, status) values ('member', email_a, 'pre-resolved', 'dismissed');
    failed := failed + 1; report := report || 'FAIL R4 a report was created already resolved; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  update public.content_reports set status = 'dismissed' where reporter = email_b;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL R5 a member resolved a report; '; end if;

  insert into public.user_blocks (blocked) values (email_a);
  select count(*) into n from public.user_blocks where blocker = email_b and blocked = email_a;
  if n = 1 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL B1 a member could not block another; '; end if;

  begin
    insert into public.user_blocks (blocker, blocked) values (email_a, email_f);
    failed := failed + 1; report := report || 'FAIL B2 a block was created in another member name; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  begin
    insert into public.user_blocks (blocked) values (email_b);
    failed := failed + 1; report := report || 'FAIL B3 a member blocked themselves; ';
  exception when check_violation then passed := passed + 1;
  end;

  begin
    insert into public.account_requests (kind, identity) values ('delete_account', email_a);
    failed := failed + 1; report := report || 'FAIL Q1 a signed-in member wrote a deletion request directly; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  begin
    perform public.delete_account_data(sup_a);
    failed := failed + 1; report := report || 'FAIL D1 a member ran the account deletion function; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  -- the reported member, and anyone else, sees neither the report nor the block
  perform set_config('request.jwt.claims', claims_a, true);
  select (select count(*) from public.content_reports) + (select count(*) from public.user_blocks) + (select count(*) from public.account_deletions) into n;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL R6 another member read %s report/block/deletion rows; ', n); end if;

  reset role;
  insert into public.account_requests (kind, identity, message) values ('delete_account', 'sec-test-request@example.test', 'sec-test please delete');
  perform set_config('request.jwt.claims', claims_a, true);
  set local role authenticated;
  select count(*) into n from public.account_requests;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL Q2 a member read deletion requests; '; end if;

  -- an admin sees and resolves both
  perform set_config('request.jwt.claims', json_build_object('sub', sup_b, 'email', email_b, 'phone', '', 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin'))::text, true);
  update public.content_reports set status = 'actioned', resolved_at = now(), resolved_by = email_b where kind = 'listing' and target_id = prod_a::text;
  get diagnostics n = row_count;
  update public.account_requests set status = 'done', resolved_at = now() where identity = 'sec-test-request@example.test';
  get diagnostics i = row_count;
  if n = 1 and i = 1 then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL R7 admin resolved %s report(s) and %s request(s); ', n, i); end if;

  -- ============================ deleting an account ====================
  -- A throwaway account with something in every corner of the app, so
  -- "delete my account" can be shown to remove all of it and nothing of
  -- anyone else's. Like everything here, it is rolled back.
  reset role;
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email_gone,
            '{"full_name": "sec-test leaving"}', '{}', now(), now())
    returning id into gone;
  claims_gone := json_build_object('sub', gone, 'email', email_gone, 'phone', '', 'role', 'authenticated')::text;

  begin
    update public.farmer_profiles set avatar_url = 'https://x.test/storage/v1/object/public/avatars/old-avatar.jpg', terms_accepted_at = now()
     where user_email = email_gone;
    insert into public.farm_batches (user_email, batch_name, batch_type, quantity, hatch_date, status)
      values (email_gone, 'sec-test leaving batch', 'broiler', 100, current_date - 10, 'active') returning id into gone_batch;
    insert into public.vaccination_tasks (batch_id, user_email, vaccine_name, day_number, scheduled_date) values (gone_batch, email_gone, 'sec-test NCD', 7, current_date);
    insert into public.mortality_logs (batch_id, user_email, date, count) values (gone_batch, email_gone, current_date, 2);
    insert into public.batch_expenses (batch_id, user_id, category, amount, expense_date) values (gone_batch, gone, 'feed', 500, current_date);
    insert into public.farm_gallery (user_email, image_url, batch_id) values (email_gone, 'https://x.test/storage/v1/object/public/farm-gallery/' || gone || '/leaving.jpg', gone_batch);
    insert into public.farm_tasks (user_email, title) values (email_gone, 'sec-test leaving task');
    insert into public.farm_finances (user_email, expense_type, amount) values (email_gone, 'feed', 100);
    insert into public.feed_calculations (user_email, batch_name, chicken_type, num_birds) values (email_gone, 'sec-test', 'broiler', 100);
    insert into public.clucky_messages (user_email, role, content) values (email_gone, 'user', 'sec-test leaving question');
    insert into public.notifications (user_email, type, title, message) values (email_gone, 'general', 'sec-test', 'sec-test leaving');
    insert into public.notification_preferences (user_email) values (email_gone) on conflict (user_email) do nothing;
    insert into public.supplier_profiles (user_id, business_name, verification_status) values (gone, 'sec-test leaving supplier', 'verified') returning id into gone_sp;
    insert into public.products (product_name, category, price, unit, user_email, supplier_id)
      values ('sec-test leaving product', 'feeds', 900, 'per_bag', email_gone, gone_sp) returning id into gone_prod;
    insert into public.vet_questions (user_email, farmer_id, category, question) values (email_gone, gone, 'Disease Symptoms', 'sec-test leaving question');
    -- a record this account wrote as a vet for the farmer: it must stay with the farmer
    insert into public.vet_medical_records (vet_id, vet_email, farmer_id, farmer_email, record_type, title)
      values (gone, email_gone, farmer, email_f, 'prescription', 'sec-test kept for the farmer') returning id into gone_rec;
  exception when others then
    failed := failed + 1; report := report || format('FAIL D0 could not seed the leaving account: %s; ', sqlerrm);
  end;

  -- what the leaving account did in the community, and what others did around it
  perform set_config('request.jwt.claims', claims_gone, true);
  set local role authenticated;
  insert into public.community_chat (user_email, message) values (email_gone, 'sec-test leaving hello') returning id into gone_msg;
  insert into public.user_blocks (blocked) values (email_a);
  insert into public.content_reports (kind, target_id, reason) values ('listing', prod_a::text, 'sec-test leaving report');
  -- the farmer's reply is written directly, as nobody: earlier checks left the farmer paused in the group
  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  insert into public.community_chat (user_email, user_name, message, reply_to_id, reply_to_user, reply_to_message)
    values (email_f, 'sec-test farmer', 'sec-test reply to the leaver', gone_msg, 'sec-test leaving', 'sec-test leaving hello')
    returning id into gone_reply;
  perform set_config('request.jwt.claims', claims_f, true);
  set local role authenticated;
  insert into public.contact_events (product_id, channel) values (gone_prod, 'call');
  insert into public.user_blocks (blocked) values (email_gone);

  reset role;
  select count(*) into i from public.farm_batches where user_email = email_f;

  begin
    res := public.delete_account_data(gone);
    passed := passed + 1;
  exception when others then
    failed := failed + 1; report := report || format('FAIL D2 account deletion raised %s %s; ', sqlstate, sqlerrm);
  end;

  select (select count(*) from public.farmer_profiles where user_email = email_gone)
       + (select count(*) from public.farm_batches where user_email = email_gone)
       + (select count(*) from public.vaccination_tasks where user_email = email_gone)
       + (select count(*) from public.mortality_logs where user_email = email_gone)
       + (select count(*) from public.batch_expenses where user_id = gone)
       + (select count(*) from public.farm_gallery where user_email = email_gone)
       + (select count(*) from public.farm_tasks where user_email = email_gone)
       + (select count(*) from public.farm_finances where user_email = email_gone)
       + (select count(*) from public.feed_calculations where user_email = email_gone)
       + (select count(*) from public.clucky_messages where user_email = email_gone)
       + (select count(*) from public.notifications where user_email = email_gone)
       + (select count(*) from public.notification_preferences where user_email = email_gone)
       + (select count(*) from public.supplier_profiles where user_id = gone)
       + (select count(*) from public.products where user_email = email_gone)
       + (select count(*) from public.vet_questions where user_email = email_gone)
       + (select count(*) from public.community_chat where user_email = email_gone)
       + (select count(*) from public.user_blocks where blocker = email_gone or blocked = email_gone)
       + (select count(*) from public.content_reports where reporter = email_gone)
       + (select count(*) from public.contact_events where product_id = gone_prod)
    into n;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || format('FAIL D3 %s row(s) of the deleted account were left behind; ', n); end if;

  select (reply_to_user = 'Former member' and reply_to_message is null and message = 'sec-test reply to the leaver') into b
    from public.community_chat where id = gone_reply;
  if coalesce(b, false) then passed := passed + 1;
  else
    select format('%s / %s / %s', reply_to_user, reply_to_message, reply_to_id) into v from public.community_chat where id = gone_reply;
    failed := failed + 1; report := report || format('FAIL D4 another member''s reply was lost, or still quotes the deleted account (%s); ', coalesce(v, 'row missing'));
  end if;

  select (vet_id is null and vet_email is null and farmer_email = email_f) into b from public.vet_medical_records where id = gone_rec;
  if coalesce(b, false) then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL D5 the farmer''s record from a departed vet was removed, or still names the vet; '; end if;

  select count(*) into n from public.farm_batches where user_email = email_f;
  select count(*) into i from public.farm_batches where user_email = email_f and i is not distinct from n;
  if n = i and exists (select 1 from public.farmer_profiles where user_email = email_f)
     and exists (select 1 from public.products where id = prod_a) then passed := passed + 1;
  else failed := failed + 1; report := report || 'FAIL D6 deleting one account touched another account''s data; '; end if;

  if (res -> 'files') ? ('https://x.test/storage/v1/object/public/farm-gallery/' || gone || '/leaving.jpg')
     and (res -> 'files') ? 'https://x.test/storage/v1/object/public/avatars/old-avatar.jpg'
     and (res -> 'counts' ->> 'batches') = '1' then passed := passed + 1;
  else failed := failed + 1; report := report || format('FAIL D7 files or counts not reported for cleanup: %s; ', left(coalesce(res::text, 'null'), 200)); end if;

  -- nothing left that stops the login itself from being deleted
  begin
    delete from auth.users where id = gone;
    passed := passed + 1;
  exception when others then
    failed := failed + 1; report := report || format('FAIL D8 the login could not be deleted afterwards: %s; ', sqlerrm);
  end;

  -- an admin account is never deleted this way
  select id into admin_id from auth.users where raw_app_meta_data ->> 'role' = 'admin' limit 1;
  if admin_id is not null then
    begin
      perform public.delete_account_data(admin_id);
      failed := failed + 1; report := report || 'FAIL D9 an admin account was deleted; ';
    exception when insufficient_privilege then passed := passed + 1;
    end;
  end if;

  -- ============================ anonymous (not signed in) =============
  reset role;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;

  begin
    insert into public.account_requests (kind, identity) values ('delete_account', 'visitor@example.test');
    failed := failed + 1; report := report || 'FAIL A6 a visitor wrote to the database directly; ';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  begin
    delete from public.products where id = prod_a;
    get diagnostics n = row_count;
    if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || 'FAIL A5 a visitor removed a listing; '; end if;
  exception when insufficient_privilege then passed := passed + 1;
  end;

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
