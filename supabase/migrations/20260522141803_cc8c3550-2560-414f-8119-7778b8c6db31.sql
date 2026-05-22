create table if not exists public.zendesk_tickets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  zendesk_ticket_id bigint unique not null,
  subject text,
  description text,
  status text,
  priority text,
  tags text[] default '{}',
  created_at timestamptz,
  solved_at timestamptz,
  updated_at timestamptz,
  requester_email text,
  satisfaction_rating text
);

create index if not exists zendesk_tickets_customer_id_idx
  on public.zendesk_tickets(customer_id);

create index if not exists zendesk_tickets_requester_email_idx
  on public.zendesk_tickets(requester_email);

alter table public.zendesk_tickets enable row level security;

create policy "auth_read_zendesk_tickets" on public.zendesk_tickets
  for select to authenticated using (true);

create policy "auth_insert_zendesk_tickets" on public.zendesk_tickets
  for insert to authenticated with check (true);

create policy "auth_update_zendesk_tickets" on public.zendesk_tickets
  for update to authenticated using (true);

create policy "auth_delete_zendesk_tickets" on public.zendesk_tickets
  for delete to authenticated using (true);