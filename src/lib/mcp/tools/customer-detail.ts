import { defineTool } from "mcp-tanstack-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const customerDetailTool = defineTool({
  name: "customer_detail",
  description:
    "Scheda 360° di un cliente per id o email: dati anagrafici, RFM, ordini, ticket, email events, raccomandazioni.",
  parameters: z.object({
    customer_id: z.string().optional(),
    email: z.string().optional(),
  }),
  execute: async ({ customer_id, email }) => {
    let cust: any = null;
    if (customer_id) {
      const { data } = await supabaseAdmin.from("customers").select("*").eq("id", customer_id).maybeSingle();
      cust = data;
    } else if (email) {
      const { data } = await supabaseAdmin.from("customers").select("*").eq("email", email).maybeSingle();
      cust = data;
    } else {
      throw new Error("Fornire customer_id oppure email");
    }
    if (!cust) return { found: false };

    const [orders, rfm, tickets, emails, recs] = await Promise.all([
      supabaseAdmin.from("orders").select("*").eq("customer_id", cust.id).order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("rfm_scores").select("*").eq("customer_id", cust.id).maybeSingle(),
      supabaseAdmin.from("zendesk_tickets").select("*").eq("customer_id", cust.id).limit(20),
      supabaseAdmin.from("email_events").select("*").eq("customer_id", cust.id).order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("recommendations").select("*").eq("customer_id", cust.id).limit(10),
    ]);

    return {
      found: true,
      customer: cust,
      rfm: rfm.data ?? null,
      orders: orders.data ?? [],
      tickets: tickets.data ?? [],
      email_events: emails.data ?? [],
      recommendations: recs.data ?? [],
    };
  },
});
