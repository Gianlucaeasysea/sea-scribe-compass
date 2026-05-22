
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_profile_read" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own_profile_upsert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own_profile_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Customers
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar_seed TEXT,
  shopify_id TEXT,
  klaviyo_id TEXT,
  circle_id TEXT,
  boat_type TEXT,
  country TEXT,
  city TEXT,
  lat NUMERIC,
  lng NUMERIC,
  lifetime_value NUMERIC NOT NULL DEFAULT 0,
  total_orders INT NOT NULL DEFAULT 0,
  first_order_at TIMESTAMPTZ,
  last_order_at TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX customers_country_idx ON public.customers(country);
CREATE INDEX customers_boat_type_idx ON public.customers(boat_type);

-- Orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  shopify_order_id TEXT,
  total NUMERIC NOT NULL,
  discount_used BOOLEAN NOT NULL DEFAULT false,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX orders_customer_idx ON public.orders(customer_id);
CREATE INDEX orders_created_idx ON public.orders(created_at DESC);

-- Email events
CREATE TABLE public.email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  campaign_name TEXT,
  flow_name TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_events_customer_idx ON public.email_events(customer_id);

-- FB ad events
CREATE TABLE public.fb_ad_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  campaign_name TEXT,
  ad_set TEXT,
  event_type TEXT NOT NULL,
  spend NUMERIC DEFAULT 0,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Circle activity
CREATE TABLE public.circle_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
  posts INT NOT NULL DEFAULT 0,
  comments INT NOT NULL DEFAULT 0,
  reactions INT NOT NULL DEFAULT 0,
  badges TEXT[] DEFAULT '{}',
  last_active_at TIMESTAMPTZ,
  engagement_score INT NOT NULL DEFAULT 0
);

-- RFM scores
CREATE TABLE public.rfm_scores (
  customer_id UUID PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  recency_score INT NOT NULL,
  frequency_score INT NOT NULL,
  monetary_score INT NOT NULL,
  tier TEXT NOT NULL,
  churn_risk INT NOT NULL DEFAULT 0,
  trend TEXT NOT NULL DEFAULT 'stable',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recommendations
CREATE TABLE public.recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_image TEXT,
  confidence INT NOT NULL,
  reason TEXT NOT NULL,
  channel TEXT NOT NULL,
  best_send TEXT,
  angle TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX recs_customer_idx ON public.recommendations(customer_id);

-- Segments
CREATE TABLE public.segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  customer_count INT DEFAULT 0,
  avg_ltv NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Marketing actions (Kanban)
CREATE TABLE public.marketing_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  segment_name TEXT,
  channel TEXT NOT NULL,
  objective TEXT NOT NULL,
  subject_line TEXT,
  expected_revenue NUMERIC DEFAULT 0,
  priority INT NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'todo',
  assignee TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  launched_at TIMESTAMPTZ
);
CREATE INDEX actions_status_idx ON public.marketing_actions(status);

-- Integrations status
CREATE TABLE public.integrations_status (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  connected BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  records_synced INT DEFAULT 0,
  status_message TEXT
);

-- RLS — authenticated workspace
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fb_ad_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfm_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations_status ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers','orders','email_events','fb_ad_events','circle_activity','rfm_scores','recommendations','segments','marketing_actions','integrations_status']
  LOOP
    EXECUTE format('CREATE POLICY "auth_read_%I" ON public.%I FOR SELECT TO authenticated USING (true);', t, t);
    EXECUTE format('CREATE POLICY "auth_insert_%I" ON public.%I FOR INSERT TO authenticated WITH CHECK (true);', t, t);
    EXECUTE format('CREATE POLICY "auth_update_%I" ON public.%I FOR UPDATE TO authenticated USING (true);', t, t);
    EXECUTE format('CREATE POLICY "auth_delete_%I" ON public.%I FOR DELETE TO authenticated USING (true);', t, t);
  END LOOP;
END $$;

-- Seed integration rows
INSERT INTO public.integrations_status (id, name, connected, status_message) VALUES
  ('shopify','Shopify',false,'Not connected'),
  ('klaviyo','Klaviyo',false,'Not connected'),
  ('facebook','Facebook Ads',false,'Not connected'),
  ('circle','Circle',false,'Not connected');
