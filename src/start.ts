import { createStart, createMiddleware } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

import { renderErrorPage } from "./lib/error-page";
import { logError } from "./lib/log-error";

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    logError(error, {
      url: request?.url,
      method: request?.method,
      source: "request-middleware",
    });
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const serverFnErrorLogger = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    try {
      return await next();
    } catch (error) {
      // Re-throw so TanStack still surfaces 4xx/Response throws normally; we
      // just need the stack landed in worker logs first.
      logError(error, { source: "server-fn" });
      throw error;
    }
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [serverFnErrorLogger, attachSupabaseAuth],
}));
