import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMapCustomers } from "@/lib/queries.functions";
import { useMemo, useRef, useState, useEffect } from "react";
import { TIER_COLOR } from "@/lib/intelligence";
import { Input } from "@/components/ui/input";
import { Search, Tag as TagIcon, ArrowRight, MessageCircle } from "lucide-react";
import { formatEuro, formatNumber, nowMs } from "@/lib/format";
import { tierIT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/map")({
  component: FleetMap,
});

const TIERS = ["Champion", "Loyal", "Potential", "New", "At Risk", "Lost"] as const;
type Tier = (typeof TIERS)[number];

function FleetMap() {
  const fetch = useServerFn(getMapCustomers);
  const { data, isLoading } = useQuery({ queryKey: ["map"], queryFn: () => fetch({}) });
  const [tier, setTier] = useState<Tier | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [hovered, setHovered] = useState<any | null>(null);
  const navigate = useNavigate();

  const allTags = useMemo(() => {
    const s = new Set<string>();
    (data ?? []).forEach((c: any) => (c.tags ?? []).forEach((t: string) => s.add(t)));
    return Array.from(s).sort().slice(0, 20);
  }, [data]);

  const filtered = useMemo(() => {
    const Q = q.toLowerCase().trim();
    return (data ?? []).filter((c: any) => {
      if (tier && c.rfm?.tier !== tier) return false;
      if (tag && !(c.tags ?? []).includes(tag)) return false;
      if (Q && !(c.name?.toLowerCase().includes(Q) || c.email?.toLowerCase().includes(Q))) return false;
      return true;
    });
  }, [data, tier, tag, q]);

  const tierStats = useMemo(() => {
    const stats: Record<string, { count: number; revenue: number }> = {};
    [...TIERS, "Unscored"].forEach((t) => (stats[t] = { count: 0, revenue: 0 }));
    (data ?? []).forEach((c: any) => {
      const t = (c.rfm?.tier as string) ?? "Unscored";
      const s = stats[t] ?? (stats[t] = { count: 0, revenue: 0 });
      s.count += 1;
      s.revenue += Number(c.lifetime_value || 0);
    });
    return stats;
  }, [data]);

  const total = data?.length ?? 0;
  const totalRevenue = useMemo(
    () => (data ?? []).reduce((s: number, c: any) => s + Number(c.lifetime_value || 0), 0),
    [data],
  );

  return (
    <div className="p-8 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <p className="font-mono text-xs text-primary tracking-widest">MAPPA CLIENTI</p>
        <h1 className="text-3xl font-semibold mt-1">{formatNumber(total)} clienti in vista</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Distribuzione geografica dei diportisti — segmenti, posizionamento RFM e concentrazione di valore in un'unica schermata.
        </p>
      </div>

      {/* Filter bar */}
      <div className="glow-card p-4 space-y-3 sticky top-0 z-10 backdrop-blur-sm bg-background/70">
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cerca per nome o email..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {formatNumber(filtered.length)} / {formatNumber(total)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip label={`Tutti · ${formatNumber(total)}`} active={tier === null} onClick={() => setTier(null)} />
          {TIERS.map((t) => (
            <Chip
              key={t}
              label={`${tierIT(t)} · ${(tierStats[t]?.count ?? 0).toLocaleString()}`}
              active={tier === t}
              color={TIER_COLOR[t]}
              onClick={() => setTier(tier === t ? null : t)}
            />
          ))}
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <TagIcon className="size-3.5 text-muted-foreground" />
            <Chip label="Qualsiasi tag" active={tag === null} onClick={() => setTag(null)} />
            {allTags.map((t) => (
              <Chip key={t} label={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)} />
            ))}
          </div>
        )}
      </div>

      {/* Tier revenue treemap — proportional bar */}
      <div className="glow-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Concentrazione valore per segmento</h3>
            <p className="text-xs text-muted-foreground">Larghezza = % del valore totale · clicca un segmento per filtrare</p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">Totale {formatEuro(totalRevenue)}</span>
        </div>
        <div className="flex h-14 rounded-md overflow-hidden border border-border">
          {[...TIERS, "Unscored"].map((t) => {
            const s = tierStats[t];
            if (!s || s.count === 0) return null;
            const pct = totalRevenue > 0 ? (s.revenue / totalRevenue) * 100 : (s.count / Math.max(1, total)) * 100;
            if (pct < 0.5) return null;
            const color = TIER_COLOR[t as Tier] ?? "oklch(0.5 0.02 260)";
            return (
              <button
                key={t}
                onClick={() => setTier(tier === t ? null : (t as Tier))}
                style={{ width: `${pct}%`, background: color, opacity: tier === null || tier === t ? 0.9 : 0.25 }}
                className="relative group transition-opacity hover:opacity-100"
                title={`${tierIT(t)} · ${s.count} clienti · ${formatEuro(s.revenue)}`}
              >
                <span className="absolute inset-0 grid place-items-center text-[11px] font-mono text-white/90 px-1 truncate">
                  {pct >= 5 ? `${tierIT(t)} ${pct.toFixed(0)}%` : ""}
                </span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
          {[...TIERS, "Unscored"].map((t) => {
            const s = tierStats[t];
            if (!s || s.count === 0) return null;
            const color = TIER_COLOR[t as Tier] ?? "oklch(0.5 0.02 260)";
            return (
              <div key={t} className="flex items-center gap-2 rounded-md border border-border bg-surface-2/40 px-2 py-1.5">
                <span className="size-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{tierIT(t)}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{s.count.toLocaleString()} · {formatEuro(s.revenue)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RFM scatter — recency (X) vs LTV (Y, log) — every customer is a dot */}
      <RfmScatter
        customers={filtered}
        onHover={setHovered}
        onClick={(c) => navigate({ to: "/customer/$id", params: { id: c.id } })}
      />

      {/* Virtualized leaderboard */}
      <CustomerList
        customers={filtered}
        loading={isLoading}
        onHover={setHovered}
        onClick={(c) => navigate({ to: "/customer/$id", params: { id: c.id } })}
      />

      {hovered && (
        <div className="fixed bottom-6 right-6 glow-card p-4 max-w-xs space-y-2 z-20 shadow-2xl border-primary/40">
          <p className="font-semibold">{hovered.name}</p>
          <p className="text-xs text-muted-foreground">{hovered.email}</p>
          {(hovered.city || hovered.country) && (
            <p className="text-xs text-muted-foreground">{[hovered.city, hovered.country].filter(Boolean).join(", ")}</p>
          )}
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">{tierIT(hovered.rfm?.tier ?? "Unscored")}</span>
            <span className="font-mono text-emerald-400">{formatEuro(hovered.lifetime_value)}</span>
            <span className="font-mono text-muted-foreground">{hovered.total_orders} ordini</span>
            {hovered.circle_id && <MessageCircle className="size-3.5 text-violet-400" />}
          </div>
          {(hovered.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {hovered.tags.slice(0, 6).map((t: string) => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">{t}</span>
              ))}
            </div>
          )}
          <p className="text-[11px] text-primary inline-flex items-center gap-1">Clicca per aprire <ArrowRight className="size-3" /></p>
        </div>
      )}
    </div>
  );
}

/* ---------- RFM scatter (SVG, scales to 30k+ dots) ---------- */
function RfmScatter({
  customers,
  onHover,
  onClick,
}: {
  customers: any[];
  onHover: (c: any | null) => void;
  onClick: (c: any) => void;
}) {
  const W = 1200;
  const H = 360;
  const PAD = { l: 56, r: 16, t: 12, b: 36 };

  const points = useMemo(() => {
    const now = Date.now();
    return customers
      .map((c) => {
        const last = c.last_order_at ? new Date(c.last_order_at).getTime() : null;
        const daysSince = last ? Math.max(1, Math.round((now - last) / 86400000)) : 720;
        const ltv = Math.max(1, Number(c.lifetime_value || 0));
        return { c, daysSince, ltv };
      })
      .sort((a, b) => b.ltv - a.ltv); // big dots underneath, small on top? draw biggest last
  }, [customers]);

  const maxDays = 720; // clamp x axis
  const maxLtv = useMemo(() => Math.max(100, ...points.map((p) => p.ltv)), [points]);

  const xScale = (d: number) => PAD.l + (Math.min(d, maxDays) / maxDays) * (W - PAD.l - PAD.r);
  const yScale = (v: number) => {
    const lv = Math.log10(v + 1) / Math.log10(maxLtv + 1);
    return H - PAD.b - lv * (H - PAD.t - PAD.b);
  };
  const rScale = (v: number) => 1.5 + (Math.log10(v + 1) / Math.log10(maxLtv + 1)) * 4.5;

  const xTicks = [0, 30, 90, 180, 365, 720];
  const yTicks = [1, 10, 100, 1000, 10000].filter((v) => v <= maxLtv * 1.2);

  return (
    <div className="glow-card p-5 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold">Posizionamento RFM</h3>
          <p className="text-xs text-muted-foreground">
            X = giorni dall'ultimo ordine · Y = valore lifetime (log) · colore = segmento · dimensione = valore
          </p>
        </div>
        <span className="text-xs font-mono text-muted-foreground">{points.length.toLocaleString()} clienti</span>
      </div>
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[700px] h-[360px]"
          onMouseLeave={() => onHover(null)}
        >
          {/* grid */}
          {yTicks.map((v) => {
            const y = yScale(v);
            return (
              <g key={v}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.08} />
                <text x={PAD.l - 6} y={y + 3} fontSize={10} textAnchor="end" className="fill-muted-foreground font-mono">
                  €{v >= 1000 ? `${v / 1000}k` : v}
                </text>
              </g>
            );
          })}
          {xTicks.map((d) => {
            const x = xScale(d);
            return (
              <g key={d}>
                <line x1={x} x2={x} y1={PAD.t} y2={H - PAD.b} stroke="currentColor" strokeOpacity={0.05} />
                <text x={x} y={H - PAD.b + 16} fontSize={10} textAnchor="middle" className="fill-muted-foreground font-mono">
                  {d === 0 ? "oggi" : `${d}g`}
                </text>
              </g>
            );
          })}
          {/* axes labels */}
          <text x={PAD.l} y={H - 6} fontSize={10} className="fill-muted-foreground">
            recenza →
          </text>

          {/* dots */}
          {points.map(({ c, daysSince, ltv }) => {
            const fill = TIER_COLOR[(c.rfm?.tier as Tier) ?? "Lost"] ?? "oklch(0.5 0.02 260)";
            const r = rScale(ltv);
            return (
              <circle
                key={c.id}
                cx={xScale(daysSince)}
                cy={yScale(ltv)}
                r={r}
                fill={fill}
                fillOpacity={0.55}
                stroke={fill}
                strokeOpacity={0.9}
                strokeWidth={0.5}
                className="cursor-pointer hover:stroke-white"
                onMouseEnter={() => onHover(c)}
                onClick={() => onClick(c)}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ---------- Virtualized customer list (handles 30k rows) ---------- */
const ROW_H = 56;
function CustomerList({
  customers,
  loading,
  onHover,
  onClick,
}: {
  customers: any[];
  loading: boolean;
  onHover: (c: any | null) => void;
  onClick: (c: any) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scroll, setScroll] = useState(0);
  const [viewport, setViewport] = useState(560);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setViewport(el.clientHeight);
    const onScroll = () => setScroll(el.scrollTop);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // sort by LTV desc for "leaderboard"
  const sorted = useMemo(
    () => [...customers].sort((a, b) => Number(b.lifetime_value) - Number(a.lifetime_value)),
    [customers],
  );

  const overscan = 6;
  const start = Math.max(0, Math.floor(scroll / ROW_H) - overscan);
  const visible = Math.ceil(viewport / ROW_H) + overscan * 2;
  const end = Math.min(sorted.length, start + visible);
  const slice = sorted.slice(start, end);

  return (
    <div className="glow-card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <h3 className="font-semibold">Classifica clienti</h3>
        <span className="text-xs font-mono text-muted-foreground">{sorted.length.toLocaleString()} clienti · ordinati per valore</span>
      </div>
      <div ref={ref} className="overflow-auto" style={{ height: 560 }}>
        {loading && <p className="text-sm text-muted-foreground text-center py-20">Caricamento…</p>}
        {!loading && sorted.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-20">Nessun cliente corrisponde alla ricerca.</p>
        )}
        <div style={{ height: sorted.length * ROW_H, position: "relative" }}>
          <div style={{ position: "absolute", top: start * ROW_H, left: 0, right: 0 }}>
            {slice.map((c: any, idx: number) => {
              const tierColor = TIER_COLOR[(c.rfm?.tier as Tier) ?? "Lost"] ?? "oklch(0.5 0.02 260)";
              return (
                <button
                  key={c.id}
                  onMouseEnter={() => onHover(c)}
                  onClick={() => onClick(c)}
                  className="w-full grid grid-cols-[40px_minmax(0,2fr)_1fr_1fr_1fr_auto] items-center gap-3 px-5 hover:bg-surface-2/60 transition-colors text-left border-b border-border/60"
                  style={{ height: ROW_H }}
                >
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {(start + idx + 1).toString().padStart(3, " ")}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm truncate">{c.name || c.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="size-2 rounded-full flex-shrink-0" style={{ background: tierColor }} />
                    <span className="text-xs truncate">{tierIT(c.rfm?.tier ?? "Unscored")}</span>
                  </div>
                  <span className="font-mono text-sm text-emerald-400 tabular-nums">{formatEuro(c.lifetime_value)}</span>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">{c.total_orders} ord</span>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    {c.circle_id && <MessageCircle className="size-3.5 text-violet-400" />}
                    <ArrowRight className="size-3.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition-all inline-flex items-center gap-1.5 ${
        active
          ? "bg-primary/20 text-primary border-primary/50"
          : "text-muted-foreground border-border hover:text-foreground hover:border-primary/30"
      }`}
    >
      {color && <span className="inline-block size-2 rounded-full" style={{ background: color }} />}
      {label}
    </button>
  );
}
