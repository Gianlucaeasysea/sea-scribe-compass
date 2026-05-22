import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMapCustomers } from "@/lib/queries.functions";
import { useMemo, useState } from "react";
import { TIER_COLOR } from "@/lib/intelligence";

export const Route = createFileRoute("/_authenticated/map")({
  component: HoneycombMap,
});

const TIERS = ["Champion", "Loyal", "Potential", "New", "At Risk", "Lost"];

function HoneycombMap() {
  const fetch = useServerFn(getMapCustomers);
  const { data } = useQuery({ queryKey: ["map"], queryFn: () => fetch({}) });
  const [filter, setFilter] = useState<string | null>(null);
  const [hovered, setHovered] = useState<any | null>(null);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const list = data ?? [];
    return filter ? list.filter((c: any) => c.rfm?.tier === filter) : list;
  }, [data, filter]);

  // Build a honeycomb grid layout
  const cellSize = 28; // hex radius
  const hexW = Math.sqrt(3) * cellSize;
  const hexH = 2 * cellSize;
  const cols = 22;
  const positions = useMemo(() => {
    return filtered.map((c: any, i: number) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * hexW + (row % 2 ? hexW / 2 : 0);
      const y = row * hexH * 0.75;
      return { c, x, y };
    });
  }, [filtered]);

  const totalRows = Math.ceil(filtered.length / cols);
  const svgH = totalRows * hexH * 0.75 + hexH;
  const svgW = cols * hexW + hexW;

  return (
    <div className="p-8 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-xs text-primary tracking-widest">HONEYCOMB MAP</p>
          <h1 className="text-3xl font-semibold mt-1">The fleet, all at once</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Each cell is a sailor. Color = tier. Hover for the signal, click to navigate.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <FilterChip label="All" active={filter === null} onClick={() => setFilter(null)} />
          {TIERS.map((t) => (
            <FilterChip
              key={t}
              label={t}
              active={filter === t}
              color={TIER_COLOR[t as keyof typeof TIER_COLOR]}
              onClick={() => setFilter(t)}
            />
          ))}
        </div>
      </div>

      <div className="glow-card p-6 relative overflow-auto">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-20">No sailors loaded yet. Visit The Bridge to load sample fleet.</p>
        )}
        <svg width={svgW} height={svgH} className="block">
          <defs>
            <filter id="glow"><feGaussianBlur stdDeviation="1.5" /></filter>
          </defs>
          {positions.map(({ c, x, y }: any) => {
            const tier = c.rfm?.tier ?? "Lost";
            const color = TIER_COLOR[tier as keyof typeof TIER_COLOR];
            const cx = x + cellSize;
            const cy = y + cellSize;
            return (
              <polygon
                key={c.id}
                points={hexPoints(cx, cy, cellSize - 2)}
                fill={color}
                fillOpacity={0.55}
                stroke={color}
                strokeWidth={1}
                className="cursor-pointer transition-all hover:stroke-2"
                style={{ filter: hovered?.id === c.id ? "url(#glow)" : undefined }}
                onMouseEnter={() => setHovered(c)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => navigate({ to: "/customer/$id", params: { id: c.id } })}
              />
            );
          })}
        </svg>

        {hovered && (
          <div className="absolute top-4 right-4 glow-card p-4 max-w-xs space-y-1 pointer-events-none">
            <p className="font-semibold">{hovered.name}</p>
            <p className="text-xs text-muted-foreground">{hovered.city}, {hovered.country}</p>
            <div className="flex gap-2 mt-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">{hovered.rfm?.tier ?? "—"}</span>
              <span className="font-mono text-muted-foreground">€{Math.round(hovered.lifetime_value)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{hovered.boat_type ?? "Boat: unknown"} · {hovered.total_orders} orders</p>
            <p className="text-[10px] text-primary mt-2">Click to navigate to customer →</p>
          </div>
        )}
      </div>
    </div>
  );
}

function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(" ");
}

function FilterChip({ label, active, color, onClick }: { label: string; active: boolean; color?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
        active ? "bg-primary/20 text-primary border-primary/50" : "text-muted-foreground border-border hover:text-foreground"
      }`}
    >
      {color && <span className="inline-block size-2 rounded-full mr-1.5" style={{ background: color }} />}
      {label}
    </button>
  );
}
