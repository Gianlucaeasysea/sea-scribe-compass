import { defineTool } from "mcp-tanstack-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const j = (v: unknown) => JSON.stringify(v);

export const zendeskTicketsTool = defineTool({
  name: "zendesk_tickets",
  description: "Ticket Zendesk con filtro status/priority e statistiche aggregate.",
  parameters: z.object({
    limit: z.number().int().min(1).max(500).default(100),
    status: z.string().optional(),
    priority: z.string().optional(),
  }),
  execute: async ({ limit, status, priority }) => {
    let q = supabaseAdmin.from("zendesk_tickets").select("*").limit(limit);
    if (status) q = q.eq("status", status);
    if (priority) q = q.eq("priority", priority);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const tickets = data ?? [];
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let satSum = 0;
    let satN = 0;
    tickets.forEach((t: any) => {
      const s = t.status || "unknown";
      byStatus[s] = (byStatus[s] ?? 0) + 1;
      const p = t.priority || "unknown";
      byPriority[p] = (byPriority[p] ?? 0) + 1;
      if (typeof t.satisfaction_rating === "number") {
        satSum += t.satisfaction_rating;
        satN++;
      }
    });
    return j({
      count: tickets.length,
      by_status: byStatus,
      by_priority: byPriority,
      avg_satisfaction: satN ? +(satSum / satN).toFixed(2) : null,
      tickets,
    });
  },
});

export const integrationsStatusTool = defineTool({
  name: "integrations_status",
  description: "Stato connettori: connesso, ultimo sync, records sincronizzati.",
  parameters: z.object({}),
  execute: async () => {
    const { data, error } = await supabaseAdmin.from("integrations_status").select("*");
    if (error) throw new Error(error.message);
    return j({ integrations: data ?? [] });
  },
});
