-- Clucky's daily allowance, counted on its own.
--
-- Until now the "clucky" edge function counted a person's questions by
-- counting their rows in clucky_messages. Two things were wrong with that:
--   1. "New chat" deletes those rows, so clearing the conversation also
--      reset the allowance. Anyone could ask without limit, and every
--      question is paid for.
--   2. Counting and then inserting are two steps, so several requests sent
--      at the same moment could all pass the check.
-- The count now lives in its own table that only the edge function can
-- touch, and taking a question is one statement.
--
-- A "day" is the calendar day in Kenya, so the allowance comes back at
-- midnight local time, which is what "ready again tomorrow" means to the
-- person reading it.

create table if not exists public.clucky_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  questions integer not null default 0 check (questions >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

comment on table public.clucky_usage is
  'How many Clucky AI questions each account has asked per day (Africa/Nairobi). Read and written only by the clucky edge function, through clucky_take_question() and clucky_refund_question().';

alter table public.clucky_usage enable row level security;

-- No permissive rule on purpose: nobody signed in can read or change a
-- count, their own included. The edge function uses the service role.
drop policy if exists block_anonymous_sessions on public.clucky_usage;
create policy block_anonymous_sessions on public.clucky_usage
  as restrictive for all to authenticated
  using (not (select public.is_anonymous_session()))
  with check (not (select public.is_anonymous_session()));

revoke all on public.clucky_usage from public, anon, authenticated;
grant select, insert, update, delete on public.clucky_usage to service_role;

-- Takes one question from today's allowance. Returns false, and changes
-- nothing, when the account has already had p_limit today.
create or replace function public.clucky_take_question(p_user_id uuid, p_limit integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  taken integer;
begin
  if p_user_id is null or p_limit is null or p_limit < 1 then
    return false;
  end if;

  insert into public.clucky_usage as u (user_id, day, questions)
  values (p_user_id, (now() at time zone 'Africa/Nairobi')::date, 1)
  on conflict (user_id, day) do update
    set questions = u.questions + 1, updated_at = now()
    where u.questions < p_limit
  returning u.questions into taken;

  return taken is not null;
end;
$$;

-- Gives a question back when the AI service failed or declined, so a
-- farmer is not charged for an answer they never got.
create or replace function public.clucky_refund_question(p_user_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.clucky_usage
     set questions = questions - 1, updated_at = now()
   where user_id = p_user_id
     and day = (now() at time zone 'Africa/Nairobi')::date
     and questions > 0;
$$;

-- Runs with the caller's own rights (not security definer), and only the
-- edge function's service role may call either one.
revoke all on function public.clucky_take_question(uuid, integer) from public, anon, authenticated;
revoke all on function public.clucky_refund_question(uuid) from public, anon, authenticated;
grant execute on function public.clucky_take_question(uuid, integer) to service_role;
grant execute on function public.clucky_refund_question(uuid) to service_role;
