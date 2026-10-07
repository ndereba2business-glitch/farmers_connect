-- Clucky AI conversation history.
--
-- Clucky becomes a real AI assistant served by the "clucky" edge function.
-- Each farmer's questions and Clucky's answers are stored here so that:
--   * the conversation is still there after a reload or on another phone
--   * Clucky can see the last few messages and follow the thread
--   * the function can limit how many questions one account asks per day
--     (every answer costs money)
--
-- Only the edge function writes rows, using the service role, after it
-- has checked who is asking. People can read and clear their own
-- conversation and nothing else.

create table if not exists public.clucky_messages (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 12000),
  created_at timestamptz not null default now()
);

comment on table public.clucky_messages is
  'Clucky AI chat history. user_email is the account identity (email, or phone for phone accounts). Written only by the clucky edge function.';

-- reading a conversation newest-first, and counting today's questions
create index if not exists clucky_messages_user_recent_idx
  on public.clucky_messages (user_email, created_at desc);

alter table public.clucky_messages enable row level security;

create policy clucky_messages_read_own on public.clucky_messages
  for select to authenticated
  using (user_email = (select public.request_identity()));

-- "Start a new conversation" clears the person's own history
create policy clucky_messages_delete_own on public.clucky_messages
  for delete to authenticated
  using (user_email = (select public.request_identity()));

revoke all on public.clucky_messages from anon;
revoke insert, update, truncate on public.clucky_messages from authenticated;
