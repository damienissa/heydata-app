-- Create connection_commands table
-- Stores slash commands auto-generated from the semantic layer.
-- Linked to connections (not semantic_layers) for simple access without extra joins.

create table if not exists public.connection_commands (
  id uuid default gen_random_uuid() primary key,
  connection_id uuid references public.connections(id) on delete cascade not null,
  slash_command text not null,  -- command name without leading slash, e.g. "showMRR"
  description text not null,   -- short label shown in picker, e.g. "Show Monthly Recurring Revenue"
  prompt text not null,        -- full prompt sent to the chat
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- One command name per connection
alter table public.connection_commands
  add constraint unique_command_per_connection unique (connection_id, slash_command);

-- Enable RLS
alter table public.connection_commands enable row level security;

-- RLS policies: access scoped via connection ownership (same pattern as semantic_layers)
create policy "Users can view commands for own connections"
  on public.connection_commands for select
  using (
    connection_id in (
      select id from public.connections where user_id = auth.uid()
    )
  );

create policy "Users can insert commands for own connections"
  on public.connection_commands for insert
  with check (
    connection_id in (
      select id from public.connections where user_id = auth.uid()
    )
  );

create policy "Users can update commands for own connections"
  on public.connection_commands for update
  using (
    connection_id in (
      select id from public.connections where user_id = auth.uid()
    )
  );

create policy "Users can delete commands for own connections"
  on public.connection_commands for delete
  using (
    connection_id in (
      select id from public.connections where user_id = auth.uid()
    )
  );

-- Index for fast connection lookups
create index if not exists idx_connection_commands_connection_id
  on public.connection_commands(connection_id);

-- Auto-update updated_at
create trigger update_connection_commands_updated_at
  before update on public.connection_commands
  for each row
  execute function public.update_updated_at_column();
