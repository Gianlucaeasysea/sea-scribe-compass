import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMapCustomers } from "@/lib/queries.functions";
import { useMemo, useState } from "react";
import { TIER_COLOR } from "@/lib/intelligence";
import { Input } from "@/components/ui/input";
import { Search, Tag as TagIcon, ArrowRight } from "lucide-react";
import { formatEuro } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/map")({
  component: HoneycombMap,
});

const TIERS = ["Champion", "Loyal", "Potential", "New", "At Risk", "Lost"] as const;
type Tier = (typeof TIERS)[number];

function HoneycombMap() {
  const fetch = useServerFn(getMapCustomers);
  const { data } = useQuery({ queryKey: ["map"], queryFn: () => fetch({}) });
  const [tier, setTier] = useState<Tier | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [hovered, setHovered] = useState<any | null>(null);
  const navigate = useNavigate();

  const allTags = useMemo(() => {
    const s = new Set<string>();
    (data ?? []).forEach((c: any) => (c.tags ?? []).forEach((t: string) => s.add(t)));
    return Array.from(s).sort();
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

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    TIERS.forEach((t) => (g[t] = []));
    g["Unscored"] = [];
    filtered.forEach((c: any) => {
      const t = (c.rfm?.tier as string) ?? "Unscored";
      (g[t] ?? g["Unscored"]).push(c);
    });
    // sort each tier by LTV desc for visual hierarchy
    Object.values(g).forEach((arr) => arr.sort((a, b) => Number(b.lifetime_value) - Number(a.lifetime_value)));
    return g;
  }, [filtered]);

  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (data ?? []).forEach((c: any) => {
      const t = (c.rfm?.tier as string) ?? "Unscored";
      counts[t] = (counts[t] ?? 0) + 1;
    });
    return counts;
  }, [data]);

  return (
    <div className="p-8 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <p className="font-mono text-xs text-primary tracking-widest">HONEYCOMB MAP</p>
        <h1 className="text-3xl font-semibold mt-1">The fleet, all at once</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Each cell is a sailor — grouped by tier, sized by LTV. Hover for the signal, click to navigate.
        </p>
      </div>

      <div className="glow-card p-4 space-y-3 sticky top-0 z-10 backdrop-blur-sm bg-background/70">
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search sailors…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {filtered.length} / {data?.length ?? 0}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip label={`All · ${data?.length ?? 0}`} active={tier === null} onClick={() => setTier(null)} />
          {TIERS.map((t) => (
            <Chip
              key={t}
              label={`${t} · ${tierCounts[t] ?? 0}`}
              active={tier === t}
              color={TIER_COLOR[t]}
              onClick={() => setTier(tier === t ? null : t)}
            />
          ))}
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <TagIcon className="size-3.5 text-muted-foreground" />
            <Chip label="Any tag" active={tag === null} onClick={() => setTag(null)} />
            {allTags.map((t) => (
              <Chip key={t} label={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)} />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-6">
        {[...TIERS, "Unscored"].map((t) => {
          const cells = grouped[t] ?? [];
          if (cells.length === 0) return null;
          const color = TIER_COLOR[t as Tier] ?? "oklch(0.5 0.02 260)";
          return (
            <div key={t} className="glow-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-sm" style={{ background: color }} />
                  <h3 className="font-semibold">{t}</h3>
                  <span className="text-xs text-muted-foreground font-mono">{cells.length}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Total {formatEuro(cells.reduce((s, c) => s + Number(c.lifetime_value || 0), 0))}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cells.map((c: any) => (
                  <HexCell
                    key={c.id}
                    customer={c}
                    color={color}
                    onHover={setHovered}
                    onClick={() => navigate({ to: "/customer/$id", params: { id: c.id } })}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-20">
            No sailors match these filters. Visit The Bridge to load or sync fleet.
          </p>
        )}
      </div>

      {hovered && (
        <div className="fixed bottom-6 right-6 glow-card p-4 max-w-xs space-y-2 z-20 shadow-2xl border-primary/40">
          <p className="font-semibold">{hovered.name}</p>
          <p className="text-xs text-muted-foreground">{hovered.email}</p>
          {(hovered.city || hovered.country) && (
            <p className="text-xs text-muted-foreground">{[hovered.city, hovered.country].filter(Boolean).join(", ")}</p>
          )}
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">{hovered.rfm?.tier ?? "Unscored"}</span>
            <span className="font-mono text-emerald-400">{formatEuro(hovered.lifetime_value)}</span>
            <span className="font-mono text-muted-foreground">{hovered.total_orders} orders</span>
          </div>
          {(hovered.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {hovered.tags.map((t: string) => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">{t}</span>
              ))}
            </div>
          )}
          <p className="text-[11px] text-primary inline-flex items-center gap-1">Click to open <ArrowRight className="size-3" /></p>
        </div>
      )}
    </div>
  );
}

function HexCell({
  customer,
  color,
  onHover,
  onClick,
}: {
  customer: any;
  color: string;
  onHover: (c: any | null) => void;
  onClick: () => void;
}) {
  // size by LTV bucket (28–48px)
  const ltv = Number(customer.lifetime_value || 0);
  const size = ltv > 1000 ? 48 : ltv > 500 ? 40 : ltv > 200 ? 34 : 28;
  const initials = (customer.name ?? customer.email ?? "?")
    .split(/\s+/)
    .map((s: string) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <button
      onMouseEnter={() => onHover(customer)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
      title={customer.name}
      className="grid place-items-center font-mono text-[10px] font-semibold text-white cursor-pointer transition-all hover:scale-110 hover:z-10 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary"
      style={{
        width: size,
        height: size,
        background: color,
        opacity: 0.85,
        clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
      }}
    >
      {initials}
    </button>
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
