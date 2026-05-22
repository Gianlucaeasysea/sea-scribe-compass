import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAnalytics } from "@/lib/queries.functions";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { LifeBuoy } from "lucide-react";

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

  // Support Health metrics
  const supportHealth = useMemo(() => {
    const tickets = (data?.tickets ?? []) as any[];
    const openStatuses = new Set(["open", "new", "pending"]);
    const openTickets = tickets.filter((t) => openStatuses.has(t.status?.toLowerCase()));
    const totalOpen = openTickets.length;

    // Average resolution time in days
    const resolved = tickets.filter((t) => t.solved_at && t.created_at);
    let avgResolutionDays = 0;
    if (resolved.length > 0) {
      const totalDays = resolved.reduce((sum, t) => {
        const created = new Date(t.created_at).getTime();
        const solved = new Date(t.solved_at).getTime();
        return sum + (solved - created) / (1000 * 60 * 60 * 24);
      }, 0);
      avgResolutionDays = Math.round((totalDays / resolved.length) * 10) / 10;
    }

    // Most common tags
    const tagCounts = new Map<string, number>();
    tickets.forEach((t) => {
      (Array.isArray(t.tags) ? t.tags : []).forEach((tag: string) => {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      });
    });
    const topTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    // Priority breakdown
    const priorityCounts = new Map<string, number>();
    tickets.forEach((t) => {
      const p = t.priority || "none";
      priorityCounts.set(p, (priorityCounts.get(p) ?? 0) + 1);
    });
    const priorityData = [...priorityCounts.entries()].map(([name, value]) => ({ name, value }));

    // Customers with most tickets
    const customerTicketCounts = new Map<string, { id: string; name: string; count: number }>();
    const customerMap = new Map<string, string>();
    (data?.customers ?? []).forEach((c: any) => customerMap.set(c.id, c.name || "Unknown"));

    tickets.forEach((t) => {
      const cid = t.customer_id;
      if (!cid) return;
      const existing = customerTicketCounts.get(cid);
      if (existing) {
        existing.count++;
      } else {
        customerTicketCounts.set(cid, { id: cid, name: customerMap.get(cid) || "Unknown", count: 1 });
      }
    });
    const topCustomers = [...customerTicketCounts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { totalOpen, avgResolutionDays, topTags, priorityData, topCustomers, totalTickets: tickets.length };
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

      {/* Support Health Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <LifeBuoy className="size-5 text-primary" />
          <h2 className="text-xl font-semibold">Support Health</h2>
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          {/* KPIs */}
          <div className="lg:col-span-3 grid grid-cols-3 gap-4">
            <div className="glow-card p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{supportHealth.totalOpen}</p>
              <p className="text-xs text-muted-foreground mt-1">Open tickets</p>
            </div>
            <div className="glow-card p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{supportHealth.avgResolutionDays}</p>
              <p className="text-xs text-muted-foreground mt-1">Avg. resolution (days)</p>
            </div>
            <div className="glow-card p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{supportHealth.totalTickets}</p>
              <p className="text-xs text-muted-foreground mt-1">Total tickets synced</p>
            </div>
          </div>

          <Card title="Top ticket tags">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={supportHealth.topTags} layout="vertical">
                <XAxis type="number" stroke="#94A3B8" fontSize={10} />
                <YAxis dataKey="name" type="category" stroke="#94A3B8" fontSize={10} width={100} />
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid #334155", borderRadius: 8 }} />
                <Bar dataKey="count" fill="#F59E0B" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Tickets by priority">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={supportHealth.priorityData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {supportHealth.priorityData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid #334155", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 text-xs mt-2">
              {supportHealth.priorityData.map((p, i) => (
                <span key={p.name} className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} /> {p.name} ({p.value})
                </span>
              ))}
            </div>
          </Card>

          <Card title="Customers with most tickets">
            <div className="space-y-3">
              {supportHealth.topCustomers.length === 0 && (
                <p className="text-sm text-muted-foreground">No ticket data yet.</p>
              )}
              {supportHealth.topCustomers.map((c, i) => (
                <div key={c.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono text-muted-foreground w-4">{i + 1}</span>
                    <span className="text-sm truncate">{c.name}</span>
                  </div>
                  <span className="text-xs font-semibold bg-muted px-2 py-0.5 rounded-full">{c.count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="glow-card p-5 space-y-3">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </div>
  );
}
