import { defineTool } from "mcp-tanstack-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listCustomersTool = defineTool({
  name: "list_customers",
  description:
    "Elenca clienti Easysea con filtri opzionali. Ritorna id, email, nome, paese, boat_type, lifetime_value, total_orders, circle_id, tags, last_order_at.",
  parameters: z.object({
    limit: z.number().int().min(1).max(500).default(50),
    country: z.string().optional(),
    boat_type: z.string().optional(),
    min_ltv: z.number().optional(),
    circle_only: z.boolean().optional(),
    search: z
      .string()
      .optional()
      .describe("Cerca in email o nome (ilike)"),
  }),
  execute: async ({ limit, country, boat_type, min_ltv, circle_only, search }) => {
    let q = supabaseAdmin
      .from("customers")
      .select(
        "id, email, name, country, boat_type, boat_model, lifetime_value, total_orders, circle_id, tags, last_order_at, community_join_date",
      )
      .limit(limit);
    if (country) q = q.eq("country", country);
    if (boat_type) q = q.eq("boat_type", boat_type);
    if (typeof min_ltv === "number") q = q.gte("lifetime_value", min_ltv);
    if (circle_only) q = q.not("circle_id", "is", null);
    if (search) q = q.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { count: data?.length ?? 0, customers: data ?? [] };
  },
});

export const customerStatsTool = defineTool({
  name: "customer_stats",
  description:
    "Statistiche aggregate clienti: totali, paganti, ricavi totali, LTV medio, membri Circle, distribuzione per paese e boat_type.",
  parameters: z.object({}),
  execute: async () => {
    type Row = {
      lifetime_value: number | null;
      country: string | null;
      boat_type: string | null;
      circle_id: string | null;
    };
    const rows: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin
        .from("customers")
        .select("lifetime_value, country, boat_type, circle_id")
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      rows.push(...(data as Row[]));
      if (data.length < 1000) break;
    }
    const paying = rows.filter((r) => Number(r.lifetime_value) > 0);
    const totalRevenue = rows.reduce((s, r) => s + Number(r.lifetime_value || 0), 0);
    const byCountry: Record<string, number> = {};
    const byBoat: Record<string, number> = {};
    let circle = 0;
    rows.forEach((r) => {
      const c = r.country || "unknown";
      byCountry[c] = (byCountry[c] ?? 0) + 1;
      const b = r.boat_type || "unknown";
      byBoat[b] = (byBoat[b] ?? 0) + 1;
      if (r.circle_id) circle++;
    });
    return {
      total: rows.length,
      paying: paying.length,
      total_revenue_eur: Math.round(totalRevenue),
      avg_ltv_paying_eur: paying.length ? Math.round(totalRevenue / paying.length) : 0,
      circle_members: circle,
      by_country: byCountry,
      by_boat_type: byBoat,
    };
  },
});
