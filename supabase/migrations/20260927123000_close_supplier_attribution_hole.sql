-- Found by supabase/tests/security.sql (check S5).
--
-- products.owner_write (FOR ALL) only checked user_email = the caller. A
-- signed-in user could therefore insert, or update their own product to,
-- a row with supplier_id pointing at SOMEONE ELSE's supplier profile. The
-- marketplace would show it under that supplier's business name with
-- their "Verified supplier" badge, and farmer contacts would be credited
-- to them. Permissive policies are OR'd, so the stricter supplier INSERT
-- policy didn't help.
--
-- Now any write through owner_write must also leave supplier_id empty or
-- set to the caller's own supplier profile. Reads/deletes (USING) are
-- unchanged.

alter policy "owner_write" on public.products
  with check (
    user_email = (select public.request_identity())
    and (
      supplier_id is null
      or supplier_id in (select sp.id from public.supplier_profiles sp where sp.user_id = (select auth.uid()))
    )
  );
