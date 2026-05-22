import { corsHeaders } from "../_shared/cors.ts";
import { claudeStructured } from "../_shared/claude.ts";

const SYSTEM_PROMPT = `You are a marine hardware marketing intelligence expert for Easysea, an Italian brand selling premium nautical products to recreational boat owners (diportisti).

Easysea product catalog:
- Olli: premium winch cover for sailboats (protects winches from UV/salt)
- Jake Poles Set: carbon fiber boat poles with rope management system
- Way2: deck organizer / line organizer for cockpit
- Flipper: innovative rope deflector / fairlead system
- Copriwinch: basic winch cover entry level

Your role: analyze customer purchase history and engagement data, then provide:
1. A concise behavioral profile (what type of sailor they likely are, what their boat setup suggests)
2. The 3 best next product recommendations with specific reasoning tied to what they already bought
3. The ideal marketing approach (channel, message angle, timing)
4. A churn risk assessment if applicable

Always respond by calling the customer_analysis tool with the structured payload.`;

const schema = {
  type: "object",
  properties: {
    profile_summary: { type: "string" },
    inferred_boat_setup: { type: "string" },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          product: { type: "string" },
          confidence: { type: "number" },
          reason: { type: "string" },
          message_angle: { type: "string" },
        },
        required: ["product", "confidence", "reason", "message_angle"],
      },
    },
    best_channel: { type: "string" },
    best_timing: { type: "string" },
    churn_risk: { type: "string", enum: ["low", "medium", "high"] },
    churn_reason: { type: "string" },
    action_priority: { type: "string", enum: ["immediate", "this_week", "this_month"] },
    suggested_subject_line: { type: "string" },
  },
  required: [
    "profile_summary",
    "inferred_boat_setup",
    "recommendations",
    "best_channel",
    "best_timing",
    "churn_risk",
    "action_priority",
    "suggested_subject_line",
  ],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { customer } = await req.json();
    if (!customer?.name) {
      return new Response(JSON.stringify({ error: "Missing customer payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orders = Array.isArray(customer.orders) ? customer.orders : [];
    const userPrompt = `Analyze this Easysea customer and provide marketing recommendations:

Customer: ${customer.name} (${customer.country ?? "unknown"})
Lifetime Value: €${customer.lifetime_value ?? 0}
Boat type: ${customer.boat_type || "unknown"}
Days since last purchase: ${customer.last_purchase_days_ago ?? "unknown"}
Email engagement: ${Math.round((customer.email_open_rate ?? 0) * 100)}% open rate
Community activity score: ${customer.circle_activity_score ?? 0}/10

Purchase history:
${orders.map((o: { product: string; price: number; date: string }) => `- ${o.product} — €${o.price} (${o.date})`).join("\n") || "(no orders)"}`;

    const analysis = await claudeStructured({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      toolName: "customer_analysis",
      toolDescription: "Return the structured marketing analysis for this Easysea customer.",
      schema,
    });

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-customer error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
