-- Clucky on the free tier of the AI service: measure it, and cope when the
-- free allowance runs out.
--
-- On the free tier one allowance is shared by every farmer, and when it is
-- used up the service refuses everyone until it resets. The owner wants to
-- start there and move to the paid tier only if usage calls for it. That
-- decision needs numbers, so this migration records them:
--   * how much each answer cost in tokens (added to clucky_usage), and
--   * the days on which the service refused, and how often
--     (clucky_service_days).
-- An admin reads both through clucky_usage_summary(). Nobody else can.

alter table public.clucky_usage
  add column if not exists input_tokens bigint not null default 0 check (input_tokens >= 0),
  add column if not exists output_tokens bigint not null default 0 check (output_tokens >= 0);

create table if not exists public.clucky_service_days (
  day date primary key,
  -- the service said its allowance was used up
  quota_hits integer not null default 0 check (quota_hits >= 0),
  -- any other failure at the service (overloaded, unreachable, error)
  failures integer not null default 0 check (failures >= 0),
  -- when the allowance last ran out, so the function can stop asking for a
  -- while instead of sending requests that are certain to be refused
  last_quota_hit timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.clucky_service_days is
  'One row per day (Africa/Nairobi) on which the AI service behind Clucky refused or failed: how many times its allowance was exhausted, and other failures. Written only by the clucky edge function; admins read it through clucky_usage_summary().';

alter table public.clucky_service_days enable row level security;

-- No permissive rule on purpose, as for clucky_usage.
drop policy if exists block_anonymous_sessions on public.clucky_service_days;
create policy block_anonymous_sessions on public.clucky_service_days
  as restrictive for all to authenticated
  using (not (select public.is_anonymous_session()))
  with check (not (select public.is_anonymous_session()));

revoke all on public.clucky_service_days from public, anon, authenticated;
grant select, insert, update, delete on public.clucky_service_days to service_role;

-- What the function needs to know before it spends anything: how many
-- questions everyone has asked today, and when the allowance last ran out.
create or replace function public.clucky_day_state()
returns table (questions_today bigint, last_quota_hit timestamptz)
language sql
stable
set search_path = ''
as $$
  select
    (select coalesce(sum(u.questions), 0) from public.clucky_usage u
      where u.day = (now() at time zone 'Africa/Nairobi')::date),
    (select max(d.last_quota_hit) from public.clucky_service_days d
      where d.day >= (now() at time zone 'Africa/Nairobi')::date - 1);
$$;

-- Adds what an answer cost to the asker's row for today.
create or replace function public.clucky_record_answer(p_user_id uuid, p_input_tokens integer, p_output_tokens integer)
returns void
language sql
set search_path = ''
as $$
  update public.clucky_usage
     set input_tokens = input_tokens + greatest(coalesce(p_input_tokens, 0), 0),
         output_tokens = output_tokens + greatest(coalesce(p_output_tokens, 0), 0),
         updated_at = now()
   where user_id = p_user_id
     and day = (now() at time zone 'Africa/Nairobi')::date;
$$;

-- Notes that the service refused ('quota') or failed ('failure') today.
create or replace function public.clucky_record_service_event(p_kind text)
returns void
language sql
set search_path = ''
as $$
  insert into public.clucky_service_days as d (day, quota_hits, failures, last_quota_hit)
  values (
    (now() at time zone 'Africa/Nairobi')::date,
    case when p_kind = 'quota' then 1 else 0 end,
    case when p_kind = 'quota' then 0 else 1 end,
    case when p_kind = 'quota' then now() end
  )
  on conflict (day) do update
    set quota_hits = d.quota_hits + excluded.quota_hits,
        failures = d.failures + excluded.failures,
        last_quota_hit = coalesce(excluded.last_quota_hit, d.last_quota_hit),
        updated_at = now();
$$;

revoke all on function public.clucky_day_state() from public, anon, authenticated;
revoke all on function public.clucky_record_answer(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.clucky_record_service_event(text) from public, anon, authenticated;
grant execute on function public.clucky_day_state() to service_role;
grant execute on function public.clucky_record_answer(uuid, integer, integer) to service_role;
grant execute on function public.clucky_record_service_event(text) to service_role;

-- The admin dashboard's view: one row per day, newest first, including
-- days when nothing happened. Counts only: no questions, no answers and
-- nobody's identity.
create or replace function public.clucky_usage_summary(p_days integer default 14)
returns table (
  day date,
  questions bigint,
  people bigint,
  input_tokens bigint,
  output_tokens bigint,
  quota_hits integer,
  failures integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Africa/Nairobi')::date;
  span integer := least(greatest(coalesce(p_days, 14), 1), 90);
begin
  if not (select public.is_app_admin()) then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  return query
  select
    g.day::date,
    coalesce(u.questions, 0)::bigint,
    coalesce(u.people, 0)::bigint,
    coalesce(u.input_tokens, 0)::bigint,
    coalesce(u.output_tokens, 0)::bigint,
    coalesce(s.quota_hits, 0),
    coalesce(s.failures, 0)
  from generate_series(today - (span - 1), today, interval '1 day') as g(day)
  left join (
    select cu.day, sum(cu.questions) as questions, count(*) filter (where cu.questions > 0) as people,
           sum(cu.input_tokens) as input_tokens, sum(cu.output_tokens) as output_tokens
      from public.clucky_usage cu
     where cu.day >= today - (span - 1)
     group by cu.day
  ) u on u.day = g.day::date
  left join public.clucky_service_days s on s.day = g.day::date
  order by g.day desc;
end;
$$;

revoke all on function public.clucky_usage_summary(integer) from public, anon;
grant execute on function public.clucky_usage_summary(integer) to authenticated;
