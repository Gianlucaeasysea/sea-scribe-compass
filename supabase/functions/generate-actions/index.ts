import { corsHeaders } from "../_shared/cors.ts";
import { claudeStructured } from "../_shared/claude.ts";

const SYSTEM_PROMPT = `You are the marketing operations brain for Easysea (Italian premium marine hardware).
Given a snapshot of the business (segment counts, recent activity, seasonal context) you return a ranked feed
of the 5-10 most valuable marketing actions to take today. Be specific, revenue-focused, and tie each action
to a concrete segment and channel. Always call the daily_actions tool.`;

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
