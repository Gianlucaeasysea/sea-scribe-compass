import { corsHeaders } from "../_shared/cors.ts";
import { claudeStructured } from "../_shared/claude.ts";

const SYSTEM_PROMPT = `Sei il cervello operativo marketing di Easysea, brand italiano premium di accessori nautici.
Dato uno snapshot del business (numero segmenti, attività recente, contesto stagionale) restituisci un feed ordinato
delle 5-10 azioni marketing più redditizie da eseguire oggi. Sii specifico, orientato al fatturato e collega ogni azione
a un segmento e canale concreti. RISPONDI SEMPRE IN ITALIANO. Chiama sempre il tool daily_actions.
Tutti i campi testuali (title, description, channel, segment, expected_revenue, cta) devono essere in italiano.
Usa euro (€) per i valori. Esempi di effort tradotti: low="basso", medium="medio", high="alto" — ma mantieni i valori enum tecnici low/medium/high invariati.`;

const schema = {
  type: "object",
  properties: {
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          priority_score: { type: "number" },
          title: { type: "string" },
          description: { type: "string" },
          channel: { type: "string" },
          segment: { type: "string" },
          expected_revenue: { type: "string" },
          effort: { type: "string", enum: ["low", "medium", "high"] },
          cta: { type: "string" },
        },
        required: ["priority_score", "title", "description", "channel", "segment", "expected_revenue", "effort", "cta"],
      },
    },
  },
  required: ["actions"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { snapshot } = await req.json();
    const safeSnapshot = snapshot ?? {};
    const userPrompt = `Today's Easysea business snapshot:

${JSON.stringify(safeSnapshot, null, 2)}

Return 5-10 prioritized marketing actions sorted by priority_score (highest first).`;

    const analysis = await claudeStructured({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      toolName: "daily_actions",
      toolDescription: "Return today's prioritized marketing action feed.",
      schema,
      maxTokens: 2000,
    });

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-actions error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
