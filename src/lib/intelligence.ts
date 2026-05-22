// Marine marketing intelligence: RFM, churn, affinity, next-best-action.
// Pure functions — safe to import anywhere.

export const PRODUCTS = [
  { name: "Olli Winch Cover", category: "deck-hardware", price: 89, image: "🛟" },
  { name: "Jake Winch Handle", category: "deck-hardware", price: 119, image: "⚓" },
  { name: "Way2 Deck Organizer", category: "organization", price: 65, image: "📦" },
  { name: "Flipper Fender Step", category: "boarding", price: 145, image: "🪜" },
  { name: "Premium Fender Set", category: "protection", price: 220, image: "🛡️" },
  { name: "Mooring Lines Kit", category: "mooring", price: 95, image: "🪢" },
  { name: "Dock Cleat Pro", category: "mooring", price: 75, image: "⚙️" },
  { name: "Rope Replacement Kit", category: "maintenance", price: 45, image: "🧵" },
  { name: "Stainless Shackle Pack", category: "deck-hardware", price: 38, image: "🔗" },
  { name: "Boat Cover XL", category: "protection", price: 380, image: "🏕️" },
] as const;

export type Product = (typeof PRODUCTS)[number];

// product affinity rules (marine domain)
const AFFINITY: Record<string, string[]> = {
  "Premium Fender Set": ["Mooring Lines Kit", "Dock Cleat Pro"],
  "Olli Winch Cover": ["Jake Winch Handle", "Way2 Deck Organizer"],
  "Jake Winch Handle": ["Rope Replacement Kit", "Way2 Deck Organizer"],
  "Flipper Fender Step": ["Premium Fender Set", "Mooring Lines Kit"],
  "Way2 Deck Organizer": ["Stainless Shackle Pack", "Olli Winch Cover"],
  "Mooring Lines Kit": ["Dock Cleat Pro", "Stainless Shackle Pack"],
  "Dock Cleat Pro": ["Mooring Lines Kit", "Premium Fender Set"],
  "Rope Replacement Kit": ["Jake Winch Handle", "Mooring Lines Kit"],
  "Stainless Shackle Pack": ["Rope Replacement Kit", "Way2 Deck Organizer"],
  "Boat Cover XL": ["Premium Fender Set", "Mooring Lines Kit"],
};

export function scoreRecency(daysSinceLast: number): number {
  if (daysSinceLast <= 30) return 5;
  if (daysSinceLast <= 90) return 4;
  if (daysSinceLast <= 180) return 3;
  if (daysSinceLast <= 365) return 2;
  return 1;
}
export function scoreFrequency(orders: number): number {
  if (orders >= 10) return 5;
  if (orders >= 6) return 4;
  if (orders >= 3) return 3;
  if (orders >= 2) return 2;
  return 1;
}
export function scoreMonetary(ltv: number): number {
  if (ltv >= 2000) return 5;
  if (ltv >= 1000) return 4;
  if (ltv >= 500) return 3;
  if (ltv >= 200) return 2;
  return 1;
}

export type RFMTier =
  | "Champion"
  | "Loyal"
  | "Potential"
  | "New"
  | "At Risk"
  | "Lost";

export function rfmTier(r: number, f: number, m: number): RFMTier {
  if (r >= 4 && f >= 4 && m >= 4) return "Champion";
  if (r >= 3 && f >= 3 && m >= 3) return "Loyal";
  if (r >= 4 && f <= 2) return "New";
  if (r >= 3 && m >= 4) return "Potential";
  if (r <= 2 && f >= 3) return "At Risk";
  return "Lost";
}

export function churnRisk(daysSinceLast: number, openRate: number, freq: number): number {
  const recency = Math.min(100, (daysSinceLast / 365) * 80);
  const engagement = (1 - openRate) * 50;
  const freqPenalty = freq < 2 ? 20 : 0;
  return Math.round(Math.min(100, recency * 0.5 + engagement * 0.3 + freqPenalty));
}

export function nextBestProducts(
  productsBought: string[],
  season: "spring" | "summer" | "fall" | "winter"
): { name: string; confidence: number; reason: string }[] {
  const recs = new Map<string, { score: number; reason: string }>();
  for (const p of productsBought) {
    const next = AFFINITY[p] ?? [];
    for (const n of next) {
      if (productsBought.includes(n)) continue;
      const existing = recs.get(n);
      const score = (existing?.score ?? 60) + 12;
      recs.set(n, { score, reason: `Bought ${p} → next: ${n}` });
    }
  }
  // seasonal boost
  if (season === "spring") {
    ["Mooring Lines Kit", "Premium Fender Set"].forEach((p) => {
      if (!productsBought.includes(p)) {
        const e = recs.get(p) ?? { score: 55, reason: "Spring maintenance push" };
        recs.set(p, { score: Math.min(98, e.score + 8), reason: e.reason });
      }
    });
  } else if (season === "fall") {
    ["Boat Cover XL", "Rope Replacement Kit"].forEach((p) => {
      if (!productsBought.includes(p)) {
        const e = recs.get(p) ?? { score: 55, reason: "Fall storage prep" };
        recs.set(p, { score: Math.min(98, e.score + 10), reason: e.reason });
      }
    });
  }
  return [...recs.entries()]
    .map(([name, v]) => ({ name, confidence: Math.min(98, v.score), reason: v.reason }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

export function bestChannel(openRate: number, circleScore: number): string {
  if (circleScore > 70 && openRate < 0.2) return "Community Post";
  if (openRate > 0.35) return "Email";
  if (openRate > 0.15) return "Email + SMS";
  return "Facebook Retargeting";
}

export function messageAngle(tier: RFMTier, products: string[]): string {
  if (tier === "At Risk") return "We miss you — exclusive welcome-back discount";
  if (tier === "Champion") return "Early access drop for our top sailors";
  if (tier === "New") return "Welcome aboard — gear up for your first season";
  if (products.includes("Premium Fender Set")) return "Safety upgrade — complete your mooring kit";
  if (products.includes("Olli Winch Cover")) return "Maintenance season — protect your winches";
  return "Personalized picks based on your last voyage";
}

export function bestSendTime(): string {
  const days = ["Tuesday", "Thursday", "Saturday"];
  const hours = ["9am", "11am", "6pm"];
  return `${days[Math.floor(Math.random() * days.length)]} ${hours[Math.floor(Math.random() * hours.length)]}`;
}

export function currentSeason(): "spring" | "summer" | "fall" | "winter" {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
}

export const TIER_COLOR: Record<RFMTier, string> = {
  Champion: "oklch(0.78 0.16 70)",   // amber
  Loyal: "oklch(0.72 0.17 162)",     // emerald
  Potential: "oklch(0.82 0.17 215)", // teal
  New: "oklch(0.7 0.17 250)",        // blue
  "At Risk": "oklch(0.7 0.18 35)",   // orange
  Lost: "oklch(0.55 0.04 260)",      // grey
};
