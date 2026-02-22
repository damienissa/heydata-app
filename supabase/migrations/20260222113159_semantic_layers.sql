-- Create semantic_layers table
create table if not exists public.semantic_layers (
  id uuid default gen_random_uuid() primary key,
  connection_id uuid references public.connections(id) on delete cascade not null,
  metrics jsonb not null default '[]',
  dimensions jsonb not null default '[]',
  entities jsonb not null default '[]',
  raw_schema jsonb,
  generated_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.semantic_layers enable row level security;

-- RLS policies: access scoped via connection ownership
create policy "Users can view semantic layers for own connections"
  on public.semantic_layers for select
  using (
    connection_id in (
      select id from public.connections where user_id = auth.uid()
    )
  );

create policy "Users can insert semantic layers for own connections"
  on public.semantic_layers for insert
  with check (
    connection_id in (
      select id from public.connections where user_id = auth.uid()
    )
  );

create policy "Users can update semantic layers for own connections"
  on public.semantic_layers for update
  using (
    connection_id in (
      select id from public.connections where user_id = auth.uid()
    )
  );

create policy "Users can delete semantic layers for own connections"
  on public.semantic_layers for delete
  using (
    connection_id in (
      select id from public.connections where user_id = auth.uid()
    )
  );

-- Index for fast connection lookups
create index if not exists idx_semantic_layers_connection_id on public.semantic_layers(connection_id);

-- Auto-update updated_at
create trigger update_semantic_layers_updated_at
  before update on public.semantic_layers
  for each row
  execute function public.update_updated_at_column();
