
# SeaMarketing Hub — Build Plan

A premium nautical-tech marketing intelligence app for Easysea. v1 ships all 7 pages with rich seeded mock data on Lovable Cloud, gated behind email + Google login. Real Shopify/Klaviyo/FB/Circle integrations are stubbed (Integration Hub shows status + "Connect" CTAs) so you can wire real keys later without rebuilding UI.

## Scope (v1)

1. **Auth** — Email + password and Google sign-in via Lovable Cloud. Login screen styled in the nautical theme ("Chart your course").
2. **Onboarding** — 4-step integration wizard (Shopify → Klaviyo → FB Ads → Circle) with animated progress. Skippable to mock data.
3. **Dashboard (Command Center)** — KPI strip, honeycomb preview, Today's Actions feed, segment performance bar chart, live activity timeline, world map of customers.
4. **Customer Intelligence Map** — Full-screen honeycomb / force graph / list views with filters, color modes, zoom/pan, pulsing nodes, connection lines for product affinity.
5. **Customer Profile (360° Whiteboard)** — Spatial layout: timeline left, identity center, recommendations right, engagement graph bottom. RFM gauge, Purchase DNA, AI summary, churn alerts.
6. **Segments Builder** — Drag-and-drop rule builder, pre-built segments, export buttons (mock).
7. **Action Queue (Kanban)** — 5 columns, draggable cards, priority scoring, AI subject lines.
8. **Analytics Center** — LTV cohort, retention heatmap, product affinity matrix, channel attribution waterfall, seasonal heatmap, churn histogram, ROAS, Klaviyo flow performance.
9. **Integration Hub** — Connection status cards, last sync, manual sync buttons.

## Design System

- Dark-only theme. Tokens defined in `src/styles.css` as oklch equivalents of: bg `#0A0F1E`, surface `#111827`, teal `#00D4FF`, amber `#F59E0B`, emerald `#10B981`, coral `#EF4444`, muted `#94A3B8`.
- Subtle blue glow borders on cards, soft pulse animations on honeycomb nodes, hover lift on cards, connection-line edges between related nodes.
- Inter (headers + body) + JetBrains Mono (metrics) loaded via Google Fonts.
- Framer Motion for transitions, page slide+fade, card lifts, glow pulses.
- Nautical empty-state illustrations (inline SVG: anchor, compass, helm).
- Toast notifications (sonner), ⌘K global customer search, keyboard shortcuts D/C/K.

## Architecture (TanStack Start)

```
src/routes/
  __root.tsx                  (Providers, ⌘K, toaster, auth listener)
  index.tsx                   (Redirects to /dashboard or /login)
  login.tsx                   (Email + Google)
  onboarding.tsx              (4-step wizard)
  _authenticated.tsx          (Auth gate layout w/ sidebar nav)
  _authenticated/dashboard.tsx
  _authenticated/map.tsx
  _authenticated/customers.$id.tsx
  _authenticated/segments.tsx
  _authenticated/queue.tsx
  _authenticated/analytics.tsx
  _authenticated/integrations.tsx
```

Shared components: `AppShell` (sidebar + topbar), `HoneycombMap`, `CustomerHexCard`, `RFMGauge`, `KpiTile`, `ActivityFeed`, `WorldMap`, `ProductCard`, `RecommendationCard`, `KanbanBoard`, `EmptyState`, etc.

## Data Layer

Lovable Cloud (Supabase) with these tables, RLS enabled, all readable by authenticated users (mock org model — single workspace for v1):

- `customers`, `orders`, `email_events`, `fb_ad_events`, `circle_activity`, `rfm_scores`, `marketing_actions`, `recommendations`, `segments`, `integrations_status`

A one-time **seed function** (server fn invoked from Integration Hub "Load demo data" button + auto-run on first onboarding skip) populates ~250 mock customers across boat types/countries with realistic order histories, RFM scores, email events, Circle activity, and 30+ recommendations. Seeded products mirror Easysea catalog (Olli, Jake, Way2, Flipper, fenders, mooring lines).

Data fetched via `createServerFn` + TanStack Query (`ensureQueryData` in loader, `useSuspenseQuery` in component).

## AI Engine (rule-based)

A pure-TS module `src/lib/intelligence.ts` computes:
- RFM scoring (recency/frequency/monetary 1–5 + tier label)
- Churn risk score
- Product affinity (hardcoded marine rules: fender→mooring lines, Olli→Jake+Way2, etc.)
- Next-best-action with channel + timing + message angle + confidence %
- Seasonal boost (spring=maintenance, fall=storage)

Run on the server during seed; results stored in `rfm_scores` and `recommendations`.

## Build Order

1. Cloud enable + auth (email + Google) + login page + `_authenticated` guard
2. Design tokens + AppShell + fonts + Framer Motion setup
3. DB schema + seed function + intelligence module
4. Dashboard (Command Center)
5. Customer Profile whiteboard
6. Honeycomb Map (custom SVG + Framer Motion; no heavy graph lib needed for 250 nodes)
7. Segments, Action Queue (Kanban via dnd-kit), Analytics (Recharts)
8. Integration Hub + onboarding wizard
9. ⌘K search, shortcuts, polish pass

## Notes / Trade-offs

- **Honeycomb**: I'll implement as an animated SVG hex grid clustered by product affinity rather than pulling in `react-force-graph`/D3 — lighter, matches the brief's look, and stays performant at 250 nodes. If you later want true force-directed physics we can swap.
- **State**: TanStack Query handles server state; local UI state stays in components. Zustand isn't needed for v1 — happy to add if you prefer.
- **Integrations**: UI fully built; real API wiring (Shopify/Klaviyo/FB/Circle) is a follow-up because each requires you to provide API keys/OAuth apps. Integration Hub buttons will show "Coming soon — paste API key" inputs ready to wire.
- **Mobile**: Responsive but desktop-first per brief.

Approve and I'll start building.
