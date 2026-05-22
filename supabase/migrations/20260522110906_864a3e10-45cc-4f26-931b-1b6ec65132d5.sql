CREATE TABLE IF NOT EXISTS public.ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_analyses_cache_key_idx ON public.ai_analyses(cache_key);
CREATE INDEX IF NOT EXISTS ai_analyses_expires_at_idx ON public.ai_analyses(expires_at);

ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_ai_analyses" ON public.ai_analyses FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_ai_analyses" ON public.ai_analyses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_ai_analyses" ON public.ai_analyses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete_ai_analyses" ON public.ai_analyses FOR DELETE TO authenticated USING (true);