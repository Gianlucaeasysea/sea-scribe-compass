alter table public.customers
  add column if not exists boat_model text,
  add column if not exists community_join_date timestamptz,
  add column if not exists community_lead_status text;