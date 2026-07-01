import { defineTool } from "mcp-tanstack-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listSegmentsTool = defineTool({
  name: "list_segments",
  description: "Elenca segmenti marketing con nome, descrizione, numero clienti, LTV medio.",
  parameters: z.object({}),
  execute: async () => {
    const { data, error } = await supabaseAdmin.from("segments").select("*");
    if (error) throw new Error(error.message);
    return { segments: data ?? [] };
  },
});

export const rfmDistributionTool = defineTool({
  name: "rfm_distribution",
  description: "Distribuzione clienti per tier RFM e churn risk medio.",
  parameters: z.object({}),
  execute: async () => {
    const rows: { tier: string; churn_risk: number | null }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin
        .from("rfm_scores")
        .select("tier, churn_risk")
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    const tiers: Record<string, { count: number; churn_sum: number }> = {};
    rows.forEach((r) => {
      tiers[r.tier] ??= { count: 0, churn_sum: 0 };
      tiers[r.tier].count++;
      tiers[r.tier].churn_sum += Number(r.churn_risk || 0);
    });
    return {
      total: rows.length,
      tiers: Object.fromEntries(
        Object.entries(tiers).map(([k, v]) => [
          k,
          { count: v.count, avg_churn_risk: v.count ? +(v.churn_sum / v.count).toFixed(3) : 0 },
        ]),
      ),
    };
  },
});

export const marketingActionsTool = defineTool({
  name: "list_marketing_actions",
  description: "Elenca azioni marketing pianificate con canale, segmento, revenue attesa, priorità, status.",
  parameters: z.object({
    status: z.string().optional(),
  }),
  execute: async ({ status }) => {
    let q = supabaseAdmin.from("marketing_actions").select("*");
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { actions: data ?? [] };
  },
});
