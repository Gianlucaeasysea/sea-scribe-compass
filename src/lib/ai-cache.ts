import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches a Claude-powered AI analysis with a 24h Supabase cache.
 * - cacheKey: stable identifier for this exact analysis (e.g. `customer:${id}:v1`)
 * - functionName: Supabase Edge Function to invoke on miss
 * - body: payload to send to the edge function
 * - force: bypass cache and re-call Claude
 */
export async function fetchAiAnalysis<T = unknown>(opts: {
  cacheKey: string;
  kind: "customer" | "segment" | "dashboard";
  functionName: "analyze-customer" | "analyze-segment" | "generate-actions";
  body: Record<string, unknown>;
  force?: boolean;
}): Promise<T> {
  if (!opts.force) {
    const { data: cached } = await supabase
      .from("ai_analyses")
      .select("payload, expires_at")
      .eq("cache_key", opts.cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (cached?.payload) return cached.payload as T;
  }

  const { data, error } = await supabase.functions.invoke(opts.functionName, {
    body: opts.body,
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(String(data.error));

  await supabase.from("ai_analyses").upsert(
    {
      cache_key: opts.cacheKey,
      kind: opts.kind,
      payload: data,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "cache_key" },
  );

  return data as T;
}
