import { useEffect } from "react";

// Reports uncaught browser errors to the server so they appear in production
// worker logs (same place as SSR errors). No-op on the server.
export function ClientErrorReporter() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const send = (
      source: string,
      message: string,
      stack: string | undefined,
    ) => {
      try {
        const body = JSON.stringify({
          source,
          message,
          stack,
          url: window.location.href,
          userAgent: navigator.userAgent,
        });
        // sendBeacon survives page unload; fall back to fetch keepalive.
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            "/api/public/client-error",
            new Blob([body], { type: "application/json" }),
          );
        } else {
          fetch("/api/public/client-error", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        // swallow — never let the reporter itself crash the app
      }
    };

    const onError = (event: ErrorEvent) => {
      send("window.error", event.message || "uncaught error", event.error?.stack);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "unhandled rejection";
      const stack = reason instanceof Error ? reason.stack : undefined;
      send("unhandledrejection", message, stack);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
