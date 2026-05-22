// Formats arbitrary thrown values into a single, grep-friendly log line that
// preserves the stack trace. Workers logs flatten objects aggressively, so we
// stringify ourselves rather than relying on console.error's default coercion.

type Extras = Record<string, unknown>;

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, val) => {
      if (val instanceof Error) {
        return { name: val.name, message: val.message, stack: val.stack };
      }
      return val;
    });
  } catch {
    return String(value);
  }
}

export function formatError(error: unknown, extras?: Extras): string {
  const tag = "[ssr-error]";
  const meta = extras ? ` ${safeStringify(extras)}` : "";

  if (error instanceof Error) {
    const cause =
      error.cause !== undefined ? ` cause=${safeStringify(error.cause)}` : "";
    return `${tag} ${error.name}: ${error.message}${cause}${meta}\n${error.stack ?? "(no stack)"}`;
  }

  if (error && typeof error === "object") {
    return `${tag} non-Error throw${meta} payload=${safeStringify(error)}`;
  }

  return `${tag} ${String(error)}${meta}`;
}

export function logError(error: unknown, extras?: Extras): void {
  // Single console.error call → single log line in Cloudflare Workers logs.
  console.error(formatError(error, extras));
}
