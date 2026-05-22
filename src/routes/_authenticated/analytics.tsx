import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAnalytics } from "@/lib/queries.functions";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";

export const Route = createFileRoute("/_authenticated/analytics")({
  component: Analytics,
});

const COLORS = ["#00D4FF", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#94A3B8"];

function Analytics() {
  const fetch = useServerFn(getAnalytics);
  const { data } = useQuery({ queryKey: ["analytics"], queryFn: () => fetch({}) });

  const monthly = useMemo(() => {
    const buckets: Record<string, number> = {};
    (data?.orders ?? []).forEach((o: any) => {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets[key] = (buckets[key] ?? 0) + Number(o.total);
    });
    return Object.entries(buckets).sort().slice(-12).map(([m, total]) => ({ m, total: Math.round(total) }));
  }, [data]);

  const productMix = useMemo(() => {
    const map = new Map<string, number>();
    (data?.orders ?? []).forEach((o: any) => {
      (Array.isArray(o.line_items) ? o.line_items : []).forEach((it: any) => {
        map.set(it.name, (map.get(it.name) ?? 0) + 1);
      });
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
  }, [data]);

  const tierMix = useMemo(() => {
    const map = new Map<string, number>();
    (data?.rfm ?? []).forEach((r: any) => map.set(r.tier, (map.get(r.tier) ?? 0) + 1));
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [data]);

  const countryMix = useMemo(() => {
    const map = new Map<string, number>();
    (data?.customers ?? []).forEach((c: any) => map.set(c.country, (map.get(c.country) ?? 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
  }, [data]);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <p className="font-mono text-xs text-primary tracking-widest">CHARTS</p>
        <h1 className="text-3xl font-semibold mt-1">Fleet analytics</h1>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Monthly revenue">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthly}>
              <XAxis dataKey="m" stroke="#94A3B8" fontSize={10} />
              <YAxis stroke="#94A3B8" fontSize={10} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #334155", borderRadius: 8 }} />
              <Line type="monotone" dataKey="total" stroke="#00D4FF" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Tier distribution">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={tierMix} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
                {tierMix.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #334155", borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 text-xs mt-2">
            {tierMix.map((t, i) => (
              <span key={t.name} className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} /> {t.name} ({t.value})
              </span>
            ))}
          </div>
        </Card>

        <Card title="Top products">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={productMix} layout="vertical">
              <XAxis type="number" stroke="#94A3B8" fontSize={10} />
              <YAxis dataKey="name" type="category" stroke="#94A3B8" fontSize={10} width={140} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #334155", borderRadius: 8 }} />
              <Bar dataKey="count" fill="#00D4FF" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Sailors by country">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={countryMix}>
              <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} />
              <YAxis stroke="#94A3B8" fontSize={10} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #334155", borderRadius: 8 }} />
              <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glow-card p-5 space-y-3">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </div>
  );
}
