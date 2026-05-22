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
