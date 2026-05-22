import { corsHeaders } from "../_shared/cors.ts";
import { claudeStructured } from "../_shared/claude.ts";

const SYSTEM_PROMPT = `Sei uno stratega marketing a livello di segmento per Easysea, brand italiano premium di accessori nautici.

Catalogo Easysea: Olli (copriwinch), Jake Poles Set (aste in carbonio), Way2 (organizer pozzetto), Flipper (deflettore cima), Copriwinch (copriwinch base).

Ricevi metriche aggregate di segmento e devi restituire un piano campagna strutturato con canali, sequenza, conversione attesa e un hook di messaggio forte. RISPONDI SEMPRE IN ITALIANO — tutti i campi testuali (segment_insight, opportunity_size, angle, sequence_steps, expected_conversion, best_message_hook, urgency_flag, type) in italiano. Chiama sempre il tool segment_analysis.`;

const schema = {
  type: "object",
  properties: {
    segment_insight: { type: "string" },
    opportunity_size: { type: "string" },
    recommended_campaign: {
      type: "object",
      properties: {
        type: { type: "string" },
        angle: { type: "string" },
        channels: { type: "array", items: { type: "string" } },
        sequence_steps: { type: "array", items: { type: "string" } },
        expected_conversion: { type: "string" },
      },
      required: ["type", "angle", "channels", "sequence_steps", "expected_conversion"],
    },
    best_message_hook: { type: "string" },
    urgency_flag: { type: "string" },
  },
  required: ["segment_insight", "opportunity_size", "recommended_campaign", "best_message_hook", "urgency_flag"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { segment } = await req.json();
    if (!segment?.name) {
      return new Response(JSON.stringify({ error: "Missing segment payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `Analizza questo segmento clienti Easysea (rispondi in italiano):

Segmento: ${segment.name}
Clienti: ${segment.customer_count}
LTV medio: €${segment.avg_ltv}
Giorni medi dall'ultimo acquisto: ${segment.avg_days_since_purchase}
Top prodotti posseduti: ${(segment.top_products ?? []).join(", ") || "—"}
Prodotti mancanti: ${(segment.missing_products ?? []).join(", ") || "—"}
Open rate medio email: ${Math.round((segment.avg_email_open_rate ?? 0) * 100)}%

Restituisci un piano campagna.`;

    const analysis = await claudeStructured({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      toolName: "segment_analysis",
      toolDescription: "Return the structured segment-level campaign plan.",
      schema,
    });

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-segment error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
