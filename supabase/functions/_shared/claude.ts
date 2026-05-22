// Shared Claude helper — calls Anthropic Messages API with forced tool-use
// to guarantee a structured JSON response matching the provided schema.
// We use raw fetch (not the SDK) for a smaller, more predictable bundle.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5";

export type JsonSchema = Record<string, unknown>;

export async function claudeStructured<T = unknown>(opts: {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  schema: JsonSchema;
  maxTokens?: number;
}): Promise<T> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const body = {
    model: MODEL,
    max_tokens: opts.maxTokens ?? 1500,
    system: [
      {
        type: "text",
        text: opts.system,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        name: opts.toolName,
        description: opts.toolDescription,
        input_schema: opts.schema,
      },
    ],
    tool_choice: { type: "tool", name: opts.toolName },
    messages: [{ role: "user", content: opts.user }],
  };

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "anthropic-beta": "prompt-caching-2024-07-31",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Anthropic error", res.status, text);
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const toolBlock = (data?.content ?? []).find(
    (b: { type: string }) => b.type === "tool_use",
  );
  if (!toolBlock?.input) {
    throw new Error("Claude returned no tool_use block");
  }
  return toolBlock.input as T;
}
