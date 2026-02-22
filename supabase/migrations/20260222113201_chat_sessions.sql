-- Create chat_sessions table
create table if not exists public.chat_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  connection_id uuid references public.connections(id) on delete set null,
  title text not null default 'New Chat',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.chat_sessions enable row level security;

-- RLS policies: users can only access their own sessions
create policy "Users can view own sessions"
  on public.chat_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.chat_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.chat_sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on public.chat_sessions for delete
  using (auth.uid() = user_id);

-- Indexes
create index if not exists idx_chat_sessions_user_id on public.chat_sessions(user_id);
create index if not exists idx_chat_sessions_connection_id on public.chat_sessions(connection_id);

-- Auto-update updated_at
create trigger update_chat_sessions_updated_at
  before update on public.chat_sessions
  for each row
  execute function public.update_updated_at_column();
