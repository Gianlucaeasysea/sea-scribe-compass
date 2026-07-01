import { defineTool } from "mcp-tanstack-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const j = (v: unknown) => JSON.stringify(v);

export const listOrdersTool = defineTool({
  name: "list_orders",
  description: "Elenca ordini recenti Easysea con totale, data, line_items e customer_id.",
  parameters: z.object({
    limit: z.number().int().min(1).max(500).default(50),
    customer_id: z.string().optional(),
    since: z.string().optional(),
  }),
  execute: async ({ limit, customer_id, since }) => {
    let q = supabaseAdmin.from("orders").select("*").order("created_at", { ascending: false }).limit(limit);
    if (customer_id) q = q.eq("customer_id", customer_id);
    if (since) q = q.gte("created_at", since);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return j({ count: data?.length ?? 0, orders: data ?? [] });
  },
});

export const revenueSummaryTool = defineTool({
  name: "revenue_summary",
  description: "Riepilogo fatturato: totale ordini, fatturato, top prodotti dagli ultimi N ordini.",
  parameters: z.object({
    last_n: z.number().int().min(10).max(2000).default(200),
  }),
  execute: async ({ last_n }) => {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("total, created_at, line_items")
      .order("created_at", { ascending: false })
      .limit(last_n);
    if (error) throw new Error(error.message);
    const orders = data ?? [];
    const revenue = orders.reduce((s, o: any) => s + Number(o.total || 0), 0);
    const productCounts: Record<string, { qty: number; revenue: number }> = {};
    orders.forEach((o: any) => {
      const items = Array.isArray(o.line_items) ? o.line_items : [];
      items.forEach((it: any) => {
        const name = it.name || "Unknown";
        const qty = Number(it.quantity || 1);
        const price = Number(it.price || 0) * qty;
        productCounts[name] ??= { qty: 0, revenue: 0 };
        productCounts[name].qty += qty;
        productCounts[name].revenue += price;
      });
    });
    const topProducts = Object.entries(productCounts)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 15)
      .map(([name, v]) => ({ name, qty: v.qty, revenue_eur: Math.round(v.revenue) }));
    return j({
      orders_analyzed: orders.length,
      total_revenue_eur: Math.round(revenue),
      top_products: topProducts,
    });
  },
});
