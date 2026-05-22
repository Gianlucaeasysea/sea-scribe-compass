import { createFileRoute } from "@tanstack/react-router";
import { logError } from "@/lib/log-error";

// Browser-side beacon target. The client posts uncaught errors / rejections
// here so the stack trace lands in production worker logs alongside SSR errors.
export const Route = createFileRoute("/api/public/client-error")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return new Response("invalid json", { status: 400 });
        }

        const p = (payload ?? {}) as {
          message?: string;
          stack?: string;
          url?: string;
          userAgent?: string;
          source?: string;
        };

        // Cap field sizes to avoid log spam / abuse.
        const trim = (s: string | undefined, max: number) =>
          typeof s === "string" ? s.slice(0, max) : undefined;

        const err = new Error(trim(p.message, 1000) ?? "client error");
        err.stack = trim(p.stack, 8000) ?? err.stack;

        logError(err, {
          source: `client.${trim(p.source, 40) ?? "unknown"}`,
          url: trim(p.url, 500),
          ua: trim(p.userAgent, 300),
        });

        return new Response(null, { status: 204 });
      },

      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "POST, OPTIONS",
            "access-control-allow-headers": "content-type",
          },
        }),
    },
  },
});
