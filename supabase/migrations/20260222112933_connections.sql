-- Create connections table
create table if not exists public.connections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  db_type text not null default 'postgresql',
  connection_string text not null,
  ssl_enabled boolean default true,
  status text default 'pending',
  last_tested_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.connections enable row level security;

-- RLS policies: users can only access their own connections
create policy "Users can view own connections"
  on public.connections for select
  using (auth.uid() = user_id);

create policy "Users can insert own connections"
  on public.connections for insert
  with check (auth.uid() = user_id);

create policy "Users can update own connections"
  on public.connections for update
  using (auth.uid() = user_id);

create policy "Users can delete own connections"
  on public.connections for delete
  using (auth.uid() = user_id);

-- Index for fast user lookups
create index if not exists idx_connections_user_id on public.connections(user_id);

-- Auto-update updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_connections_updated_at
  before update on public.connections
  for each row
  execute function public.update_updated_at_column();
