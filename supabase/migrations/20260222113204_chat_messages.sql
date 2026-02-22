-- Create chat_messages table
create table if not exists public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.chat_sessions(id) on delete cascade not null,
  role text not null,
  content text not null,
  tool_results jsonb,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.chat_messages enable row level security;

-- RLS policies: access scoped via session ownership
create policy "Users can view messages for own sessions"
  on public.chat_messages for select
  using (
    session_id in (
      select id from public.chat_sessions where user_id = auth.uid()
    )
  );

create policy "Users can insert messages for own sessions"
  on public.chat_messages for insert
  with check (
    session_id in (
      select id from public.chat_sessions where user_id = auth.uid()
    )
  );

create policy "Users can delete messages for own sessions"
  on public.chat_messages for delete
  using (
    session_id in (
      select id from public.chat_sessions where user_id = auth.uid()
    )
  );

-- Index for fast session lookups (ordered by creation time)
create index if not exists idx_chat_messages_session_id on public.chat_messages(session_id, created_at);
