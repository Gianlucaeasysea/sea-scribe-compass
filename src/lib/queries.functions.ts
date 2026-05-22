// All read server functions for the dashboard, profile, map, etc.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

export const refreshFleet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await (supabaseAdmin as any).rpc("refresh_fleet");
    if (error) throw new Error(error.message);
    return data as { customers: number; rfm: number; recommendations: number; actions: number };
  });

// Re-tag every customer based on which connectors carry data for them.
// Shopify is the canonical base (shopify_id); Klaviyo/Circle/Facebook match
// by joining on customer_id already resolved during each connector sync.
export const unifyCustomerProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    await (supabaseAdmin as any).rpc("refresh_fleet");

    const [{ data: customers }, { data: emailEv }, { data: circleAct }, { data: fbEv }] = await Promise.all([
      supabaseAdmin.from("customers").select("id, email, shopify_id, klaviyo_id, circle_id, tags"),
      supabaseAdmin.from("email_events").select("customer_id"),
      supabaseAdmin.from("circle_activity").select("customer_id"),
      supabaseAdmin.from("fb_ad_events").select("customer_id"),
    ]);

    const klavSet = new Set((emailEv ?? []).map((e: any) => e.customer_id));
    const circleSet = new Set((circleAct ?? []).map((c: any) => c.customer_id));
    const fbSet = new Set((fbEv ?? []).map((f: any) => f.customer_id));

    const SOURCE_TAGS = new Set(["shopify", "klaviyo", "circle-member", "circle-only", "facebook"]);
    const updates: { id: string; email: string; tags: string[] }[] = [];

    let total = 0, shopify = 0, noShopify = 0;
    let klavMatched = 0, klavOnly = 0;
    let circleMatched = 0, circleOnly = 0;
    let fbMatched = 0;

    for (const c of (customers ?? []) as any[]) {
      total++;
      const hasShopify = !!c.shopify_id;
      const hasKlav = !!c.klaviyo_id || klavSet.has(c.id);
      const hasCircle = !!c.circle_id || circleSet.has(c.id);
      const hasFb = fbSet.has(c.id);

      if (hasShopify) shopify++; else noShopify++;
      if (hasKlav) { hasShopify ? klavMatched++ : klavOnly++; }
      if (hasCircle) { hasShopify ? circleMatched++ : circleOnly++; }
      if (hasFb && hasShopify) fbMatched++;

      const base = (Array.isArray(c.tags) ? c.tags : []).filter((t: string) => !SOURCE_TAGS.has(t));
      const next = [...base];
      if (hasShopify) next.push("shopify");
      if (hasKlav) next.push("klaviyo");
      if (hasCircle) next.push("circle-member");
      if (hasCircle && !hasShopify) next.push("circle-only");
      if (hasFb) next.push("facebook");

      updates.push({ id: c.id, email: c.email, tags: Array.from(new Set(next)) });
    }

    for (let i = 0; i < updates.length; i += 500) {
      const batch = updates.slice(i, i + 500);
      await (supabaseAdmin.from("customers") as any).upsert(batch, { onConflict: "id" });
    }

    return {
      total, shopify, noShopify,
      klaviyoMatched: klavMatched, klaviyoOnly: klavOnly,
      circleMatched, circleOnly,
      facebookMatched: fbMatched,
    };
  });

export const getDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [customersCnt, recs, orders, actions, integ] = await Promise.all([
      supabase.from("customers").select("*", { count: "exact", head: true }),
      supabase.from("recommendations").select("*").eq("status", "pending").limit(10).order("confidence", { ascending: false }),
      supabase.from("orders").select("total, created_at, customer_id").order("created_at", { ascending: false }).limit(20),
      supabase.from("marketing_actions").select("*"),
      supabase.from("integrations_status").select("*"),
    ]);

    // Paginate rfm_scores (default cap is 1000)
    const rfm: { tier: string }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("rfm_scores")
        .select("tier")
        .range(from, from + 999);
      if (error) break;
      if (!data || data.length === 0) break;
      rfm.push(...data);
      if (data.length < 1000) break;
    }

    const totalCustomers = customersCnt.count ?? 0;
    const atRisk = rfm.filter((r) => r.tier === "At Risk").length;
    const champion = rfm.filter((r) => r.tier === "Champion" || r.tier === "Loyal").length;
    const allActions = actions.data ?? [];
    const opportunity = allActions.reduce((s, a) => s + Number(a.expected_revenue || 0), 0);

    // Paginate customers for accurate LTV aggregates
    let ltvSum = 0;
    let payingCount = 0;
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("customers")
        .select("lifetime_value")
        .range(from, from + 999);
      if (error) break;
      if (!data || data.length === 0) break;
      for (const c of data) {
        const v = Number(c.lifetime_value || 0);
        ltvSum += v;
        if (v > 0) payingCount += 1;
      }
      if (data.length < 1000) break;
    }
    const avgLtv = payingCount > 0 ? Math.round(ltvSum / payingCount) : 0;
    const totalRevenue = Math.round(ltvSum);

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
        totalRevenue,
        payingCustomers: payingCount,
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
    // Paginate to bypass Supabase's 1000-row default limit
    const PAGE = 1000;
    const customers: any[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, email, country, city, lat, lng, lifetime_value, boat_type, boat_model, community_join_date, community_lead_status, tags, last_order_at, total_orders, avatar_seed, circle_id, shopify_id, klaviyo_id")
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      customers.push(...data);
      if (data.length < PAGE) break;
    }
    const { data: rfm } = await supabase.from("rfm_scores").select("customer_id, tier, recency_score, frequency_score, monetary_score, churn_risk").range(0, 49999);
    const { data: orders } = await supabase.from("orders").select("customer_id, line_items").range(0, 49999);

    const rfmMap = new Map((rfm ?? []).map((r) => [r.customer_id, r]));
    const productsByCustomer = new Map<string, Set<string>>();
    (orders ?? []).forEach((o) => {
      const items = Array.isArray(o.line_items) ? (o.line_items as any[]) : [];
      const set = productsByCustomer.get(o.customer_id) ?? new Set<string>();
      items.forEach((it: any) => set.add(it.name));
      productsByCustomer.set(o.customer_id, set);
    });

    return customers.map((c) => ({
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
    const [{ data: customer }, { data: orders }, { data: emails }, { data: fb }, { data: circle }, { data: rfm }, { data: recs }, { data: tickets }] = await Promise.all([
      supabase.from("customers").select("*").eq("id", data.id).maybeSingle(),
      supabase.from("orders").select("*").eq("customer_id", data.id).order("created_at", { ascending: false }),
      supabase.from("email_events").select("*").eq("customer_id", data.id).order("occurred_at", { ascending: false }).limit(100),
      supabase.from("fb_ad_events").select("*").eq("customer_id", data.id),
      supabase.from("circle_activity").select("*").eq("customer_id", data.id).maybeSingle(),
      supabase.from("rfm_scores").select("*").eq("customer_id", data.id).maybeSingle(),
      supabase.from("recommendations").select("*").eq("customer_id", data.id).order("confidence", { ascending: false }),
      supabase.from("zendesk_tickets").select("*").eq("customer_id", data.id).order("created_at", { ascending: false }),
    ]);
    return { customer, orders: orders ?? [], emails: emails ?? [], fb: fb ?? [], circle, rfm, recs: recs ?? [], tickets: tickets ?? [] };
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
    const [{ data: orders }, { data: rfm }, { data: customers }, { data: fb }, { data: tickets }] = await Promise.all([
      supabase.from("orders").select("total, created_at, line_items, customer_id, discount_used"),
      supabase.from("rfm_scores").select("churn_risk, tier"),
      supabase.from("customers").select("id, country, boat_type, lifetime_value, first_order_at, total_orders, name"),
      supabase.from("fb_ad_events").select("campaign_name, spend, event_type"),
      supabase.from("zendesk_tickets").select("*, customer_id"),
    ]);
    return {
      orders: orders ?? [],
      rfm: rfm ?? [],
      customers: customers ?? [],
      fb: fb ?? [],
      tickets: tickets ?? [],
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
