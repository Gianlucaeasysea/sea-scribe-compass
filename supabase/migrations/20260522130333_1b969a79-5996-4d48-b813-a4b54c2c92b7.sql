create table if not exists public.credentials_config (
  id text primary key,
  credentials jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.credentials_config enable row level security;

create policy "service_role only" on public.credentials_config
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');