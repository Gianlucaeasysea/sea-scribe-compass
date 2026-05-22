import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMapCustomers } from "@/lib/queries.functions";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/fleet")({
  component: Fleet,
});

function Fleet() {
  const fetch = useServerFn(getMapCustomers);
  const { data } = useQuery({ queryKey: ["map"], queryFn: () => fetch({}) });
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const list = data ?? [];
    if (!q) return list;
    const Q = q.toLowerCase();
    return list.filter((c: any) =>
      c.name?.toLowerCase().includes(Q) ||
      c.email?.toLowerCase().includes(Q) ||
      c.country?.toLowerCase().includes(Q)
    );
  }, [data, q]);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <p className="font-mono text-xs text-primary tracking-widest">FLEET</p>
        <h1 className="text-3xl font-semibold mt-1">All sailors</h1>
      </div>

      <Input placeholder="Search by name, email, country…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />

      <div className="glow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-3">Sailor</th>
              <th className="text-left p-3">Location</th>
              <th className="text-left p-3">Tier</th>
              <th className="text-right p-3">LTV</th>
              <th className="text-right p-3">Orders</th>
              <th className="text-right p-3">Last order</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 200).map((c: any) => (
              <tr key={c.id} className="border-t border-border hover:bg-surface-2/40 transition">
                <td className="p-3">
                  <Link to="/customer/$id" params={{ id: c.id }} className="hover:text-primary">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                  </Link>
                </td>
                <td className="p-3 text-muted-foreground text-xs">{c.city}, {c.country}</td>
                <td className="p-3">
                  <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">
                    {c.rfm?.tier ?? "—"}
                  </span>
                </td>
                <td className="p-3 text-right font-mono">€{Math.round(c.lifetime_value)}</td>
                <td className="p-3 text-right font-mono text-muted-foreground">{c.total_orders}</td>
                <td className="p-3 text-right text-xs text-muted-foreground">
                  {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-8 text-center text-muted-foreground text-sm">No sailors aboard.</p>}
      </div>
    </div>
  );
}
