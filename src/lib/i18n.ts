// Italian display helpers for backend-stored enums.

export const TIER_LABEL_IT: Record<string, string> = {
  Champion: "Campione",
  Loyal: "Fedele",
  Potential: "Potenziale",
  New: "Nuovo",
  "At Risk": "A rischio",
  Lost: "Perso",
  Unscored: "Non valutato",
};

export const tierIT = (t?: string | null) =>
  t ? (TIER_LABEL_IT[t] ?? t) : "—";

export const SEGMENT_LABEL_IT: Record<string, string> = {
  Champion: "Campioni",
  Loyal: "Clienti fedeli",
  "At Risk": "A rischio",
  New: "Nuovi clienti",
  Potential: "Potenziali",
  Lost: "Persi",
};

export const segmentIT = (t?: string | null) =>
  t ? (SEGMENT_LABEL_IT[t] ?? t) : "—";

export const CHANNEL_LABEL_IT: Record<string, string> = {
  Email: "Email",
  "Email + SMS": "Email + SMS",
  SMS: "SMS",
  Facebook: "Facebook Ads",
  "Facebook Ads": "Facebook Ads",
  Community: "Community",
  Direct: "Diretto",
};

export const channelIT = (c?: string | null) =>
  c ? (CHANNEL_LABEL_IT[c] ?? c) : "—";

export const OBJECTIVE_LABEL_IT: Record<string, string> = {
  "Cross-sell": "Cross-sell",
  Reactivation: "Riattivazione",
  Retention: "Fidelizzazione",
  Upsell: "Upsell",
  Onboarding: "Onboarding",
  Conversion: "Conversione",
  Discover: "Scoperta",
  "Win-back": "Riconquista",
};

export const objectiveIT = (o?: string | null) =>
  o ? (OBJECTIVE_LABEL_IT[o] ?? o) : "—";

// Tailwind class pills per RFM tier — used for badges across the app.
export const TIER_BADGE_CLASS: Record<string, string> = {
  Champion: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  Loyal: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  Potential: "bg-primary/20 text-primary border-primary/40",
  New: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  "At Risk": "bg-orange-500/20 text-orange-300 border-orange-500/40",
  Lost: "bg-muted text-muted-foreground border-border",
};
export const tierBadgeClass = (t?: string | null) =>
  TIER_BADGE_CLASS[t ?? ""] ?? "bg-muted text-muted-foreground border-border";

// Boat type → emoji.
export const boatIcon = (type?: string | null): string => {
  if (!type) return "";
  const t = type.toLowerCase();
  if (t.includes("sail") || t.includes("vela")) return "⛵";
  if (t.includes("motor") || t.includes("yacht")) return "🚤";
  return "🛥️";
};

// Country name/code → flag emoji. Accepts ISO2 codes or common Italian/English names.
const COUNTRY_CODE: Record<string, string> = {
  italy: "IT", italia: "IT", it: "IT",
  france: "FR", francia: "FR", fr: "FR",
  spain: "ES", spagna: "ES", es: "ES",
  germany: "DE", germania: "DE", de: "DE",
  "united kingdom": "GB", uk: "GB", gb: "GB", inghilterra: "GB",
  "united states": "US", usa: "US", us: "US", "stati uniti": "US",
  croatia: "HR", croazia: "HR", hr: "HR",
  greece: "GR", grecia: "GR", gr: "GR",
  portugal: "PT", portogallo: "PT", pt: "PT",
  netherlands: "NL", olanda: "NL", "paesi bassi": "NL", nl: "NL",
  switzerland: "CH", svizzera: "CH", ch: "CH",
  belgium: "BE", belgio: "BE", be: "BE",
  monaco: "MC", mc: "MC",
  malta: "MT", mt: "MT",
};
export const countryFlag = (country?: string | null): string => {
  if (!country) return "";
  const key = country.trim().toLowerCase();
  const code = COUNTRY_CODE[key] ?? (country.trim().length === 2 ? country.trim().toUpperCase() : null);
  if (!code || code.length !== 2) return "";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
};

// Italian relative time: "5 minuti fa", "2 ore fa", "ieri", "3 giorni fa".
export const relativeTimeIT = (value?: string | number | Date | null): string => {
  if (!value) return "mai";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 30) return "pochi secondi fa";
  if (diffSec < 60) return `${diffSec} secondi fa`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m} minut${m === 1 ? "o" : "i"} fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} or${h === 1 ? "a" : "e"} fa`;
  const days = Math.floor(h / 24);
  if (days === 1) return "ieri";
  if (days < 30) return `${days} giorni fa`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mes${months === 1 ? "e" : "i"} fa`;
  const years = Math.floor(months / 12);
  return `${years} ann${years === 1 ? "o" : "i"} fa`;
};

// Translate integration sync status messages from English to Italian.
const STATUS_REPLACEMENTS: Array<[RegExp, string]> = [
  [/timeout,\s*rilancia per continuare/gi, "sincronizzazione parziale — riprova"],
  [/\bclients?\b/gi, "clienti"],
  [/\borders?\b/gi, "ordini"],
  [/\bproducts?\b/gi, "prodotti"],
  [/\bmatched\b/gi, "abbinati"],
  [/\bsynced\b/gi, "sincronizzati"],
  [/\bfetched\b/gi, "recuperati"],
  [/\bevents?\b/gi, "eventi"],
  [/\bmembers?\b/gi, "membri"],
  [/\brecords?\b/gi, "record"],
  [/\bcampaigns?\b/gi, "campagne"],
  [/\btickets?\b/gi, "ticket"],
  [/\bsolved\b/gi, "risolti"],
];
export const translateStatusMessage = (msg?: string | null): string => {
  if (!msg) return "";
  let out = msg;
  for (const [re, to] of STATUS_REPLACEMENTS) out = out.replace(re, to);
  return out;
};
