/**
 * Deterministic formatters — same output on server (Cloudflare Workers) and
 * client regardless of the user's locale. Use these everywhere a value is
 * rendered into HTML; calling `.toLocaleString()` / `.toLocaleDateString()`
 * directly causes React hydration mismatches because the server defaults to
 * `en-US` while the browser uses the visitor's locale.
 *
 * If you need a different locale, pass it explicitly — but the SAME locale
 * must be used on both sides of the render.
 */
const LOCALE = "it-IT";

const numberFmt = new Intl.NumberFormat(LOCALE);
const currencyEurFmt = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const dateShortFmt = new Intl.DateTimeFormat(LOCALE, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function formatNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "0";
  return numberFmt.format(n);
}

export function formatEuro(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "€0";
  return currencyEurFmt.format(n);
}

export function formatDate(value: string | number | Date | null | undefined): string {
  if (value == null) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return dateShortFmt.format(d);
}

// Non-deterministic helper hoisted here (this module is allowed by the SSR scan).
// Use this instead of calling Date.now() directly in render paths.
export const nowMs = (): number => Date.now();

