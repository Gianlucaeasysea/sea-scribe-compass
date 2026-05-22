// All read server functions for the dashboard, profile, map, etc.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [customersCnt, rfmRows, recs, orders, actions, integ] = await Promise.all([
      supabase.from("customers").select("*", { count: "exact", head: true }),
      supabase.from("rfm_scores").select("*"),
      supabase.from("recommendations").select("*").eq("status", "pending").limit(10).order("confidence", { ascending: false }),
      supabase.from("orders").select("total, created_at, customer_id").order("created_at", { ascending: false }).limit(20),
      supabase.from("marketing_actions").select("*"),
      supabase.from("integrations_status").select("*"),
    ]);
    const totalCustomers = customersCnt.count ?? 0;
    const rfm = rfmRows.data ?? [];
    const atRisk = rfm.filter((r) => r.tier === "At Risk" || r.tier === "Lost").length;
    const champion = rfm.filter((r) => r.tier === "Champion").length;
    const allActions = actions.data ?? [];
    const opportunity = allActions.reduce((s, a) => s + Number(a.expected_revenue || 0), 0);

    const { data: customersForLtv } = await supabase.from("customers").select("lifetime_value");
    const ltvSum = (customersForLtv ?? []).reduce((s, c) => s + Number(c.lifetime_value || 0), 0);
    const avgLtv = totalCustomers > 0 ? Math.round(ltvSum / totalCustomers) : 0;

    // segment buckets
    const tierCounts: Record<string, number> = {};
    rfm.forEach((r) => (tierCounts[r.tier] = (tierCounts[r.tier] ?? 0) + 1));

    return {
      kpi: {
        totalCustomers,
        avgLtv,
        atRisk,
        champion,
        opportunity,
        pendingActions: allActions.filter((a) => a.status === "todo").length,
      },
      tierCounts,
      topRecs: recs.data ?? [],
      recentOrders: orders.data ?? [],
      integrations: integ.data ?? [],
    };
  });

export const getMapCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name, email, country, city, lat, lng, lifetime_value, boat_type, tags, last_order_at, total_orders, avatar_seed, circle_id, shopify_id, klaviyo_id");
    const { data: rfm } = await supabase.from("rfm_scores").select("customer_id, tier, recency_score, frequency_score, monetary_score, churn_risk");
    const { data: orders } = await supabase.from("orders").select("customer_id, line_items");

    const rfmMap = new Map((rfm ?? []).map((r) => [r.customer_id, r]));
    const productsByCustomer = new Map<string, Set<string>>();
    (orders ?? []).forEach((o) => {
      const items = Array.isArray(o.line_items) ? (o.line_items as any[]) : [];
      const set = productsByCustomer.get(o.customer_id) ?? new Set<string>();
      items.forEach((it: any) => set.add(it.name));
      productsByCustomer.set(o.customer_id, set);
    });

    return (customers ?? []).map((c) => ({
      ...c,
      rfm: rfmMap.get(c.id) ?? null,
      products: [...(productsByCustomer.get(c.id) ?? new Set<string>())],
    }));
  });

export const getCustomerProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const [{ data: customer }, { data: orders }, { data: emails }, { data: fb }, { data: circle }, { data: rfm }, { data: recs }] = await Promise.all([
      supabase.from("customers").select("*").eq("id", data.id).maybeSingle(),
      supabase.from("orders").select("*").eq("customer_id", data.id).order("created_at", { ascending: false }),
      supabase.from("email_events").select("*").eq("customer_id", data.id).order("occurred_at", { ascending: false }).limit(100),
      supabase.from("fb_ad_events").select("*").eq("customer_id", data.id),
      supabase.from("circle_activity").select("*").eq("customer_id", data.id).maybeSingle(),
      supabase.from("rfm_scores").select("*").eq("customer_id", data.id).maybeSingle(),
      supabase.from("recommendations").select("*").eq("customer_id", data.id).order("confidence", { ascending: false }),
    ]);
    return { customer, orders: orders ?? [], emails: emails ?? [], fb: fb ?? [], circle, rfm, recs: recs ?? [] };
  });

export const getSegments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: segments } = await supabase.from("segments").select("*");
    const { data: rfm } = await supabase.from("rfm_scores").select("tier, customer_id");
    const { data: customers } = await supabase.from("customers").select("id, lifetime_value, tags, boat_type, first_order_at");
    const byTier: Record<string, string[]> = {};
    (rfm ?? []).forEach((r) => {
      byTier[r.tier] = byTier[r.tier] ?? [];
      byTier[r.tier].push(r.customer_id);
    });
    return {
      segments: segments ?? [],
      tierCounts: Object.fromEntries(Object.entries(byTier).map(([k, v]) => [k, v.length])),
      totalCustomers: (customers ?? []).length,
    };
  });

export const getActions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("marketing_actions").select("*").order("priority", { ascending: false });
    return data ?? [];
  });

export const updateActionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), status: z.string() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("marketing_actions")
      .update({ status: data.status, launched_at: data.status === "launched" ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: orders }, { data: rfm }, { data: customers }, { data: fb }] = await Promise.all([
      supabase.from("orders").select("total, created_at, line_items, customer_id, discount_used"),
      supabase.from("rfm_scores").select("churn_risk, tier"),
      supabase.from("customers").select("id, country, boat_type, lifetime_value, first_order_at, total_orders"),
      supabase.from("fb_ad_events").select("campaign_name, spend, event_type"),
    ]);
    return {
      orders: orders ?? [],
      rfm: rfm ?? [],
      customers: customers ?? [],
      fb: fb ?? [],
    };
  });

export const getIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("integrations_status").select("*");
    return data ?? [];
  });

export const searchCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ q: z.string().max(100) }).parse(input))
  .handler(async ({ context, data }) => {
    if (!data.q) return [];
    const { data: rows } = await context.supabase
      .from("customers")
      .select("id, name, email, country, lifetime_value")
      .or(`name.ilike.%${data.q}%,email.ilike.%${data.q}%`)
      .limit(8);
    return rows ?? [];
  });

export const updateCustomerTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      tags: z.array(z.string().min(1).max(40)).max(30),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const clean = Array.from(new Set(data.tags.map((t) => t.trim()).filter(Boolean)));
    const { error } = await context.supabase
      .from("customers")
      .update({ tags: clean })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, tags: clean };
  });
