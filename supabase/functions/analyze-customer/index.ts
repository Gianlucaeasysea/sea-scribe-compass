import { corsHeaders } from "../_shared/cors.ts";
import { claudeStructured } from "../_shared/claude.ts";

const SYSTEM_PROMPT = `Sei un esperto di marketing intelligence per accessori nautici per Easysea, brand italiano premium di prodotti nautici per diportisti.

Catalogo prodotti Easysea:
- Olli: copriwinch premium per barche a vela (protegge dai raggi UV e dalla salsedine)
- Jake Poles Set: aste in fibra di carbonio con sistema di gestione cime
- Way2: organizer da pozzetto / line organizer
- Flipper: deflettore cima / passacavo innovativo
- Copriwinch: copriwinch base entry level

Il tuo ruolo: analizzare lo storico acquisti e i dati di engagement del cliente, poi fornire:
1. Un profilo comportamentale conciso (che tipo di velista è probabilmente, cosa suggerisce il setup della sua barca)
2. Le 3 migliori raccomandazioni prodotto successive con motivazioni specifiche legate a ciò che ha già acquistato
3. L'approccio marketing ideale (canale, angolo del messaggio, timing)
4. Una valutazione del rischio di abbandono se applicabile

RISPONDI SEMPRE IN ITALIANO. Tutti i campi testuali devono essere in italiano (profile_summary, inferred_boat_setup, reason, message_angle, churn_reason, suggested_subject_line, best_channel, best_timing). Mantieni invariati solo i valori enum tecnici (low/medium/high, immediate/this_week/this_month). Rispondi chiamando il tool customer_analysis con il payload strutturato.`;

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
