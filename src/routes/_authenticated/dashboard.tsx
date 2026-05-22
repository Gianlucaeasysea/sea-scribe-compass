import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardData, refreshFleet } from "@/lib/queries.functions";
import { seedDemoData } from "@/lib/seed.functions";
import { syncShopify, syncKlaviyo, syncFacebook, syncCircle } from "@/lib/sync.functions";
import { Link } from "@tanstack/react-router";
import {
  Users, TrendingUp, AlertTriangle, Crown, DollarSign, Sparkles, Database, ArrowRight,
  RefreshCw, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatEuro } from "@/lib/format";
import { ClaudeActionsFeed } from "@/components/ai/claude-actions-feed";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const TIER_COLORS: Record<string, string> = {
  Champion: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  Loyal: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  Potential: "bg-primary/20 text-primary border-primary/40",
  New: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  "At Risk": "bg-orange-500/20 text-orange-300 border-orange-500/40",
  Lost: "bg-muted text-muted-foreground border-border",
};

function Dashboard() {
  const fetch = useServerFn(getDashboardData);
  const seed = useServerFn(seedDemoData);
  const shopifyFn = useServerFn(syncShopify);
  const klaviyoFn = useServerFn(syncKlaviyo);
  const facebookFn = useServerFn(syncFacebook);
  const circleFn = useServerFn(syncCircle);
  const refreshFn = useServerFn(refreshFleet);
  const qc = useQueryClient();
  const { data, isLoading, isFetching } = useQuery({ queryKey: ["dashboard"], queryFn: () => fetch({}) });
  const seedMut = useMutation({
    mutationFn: () => seed({}),
    onSuccess: (r: any) => {
      toast.success(r?.skipped ? "Fleet already loaded" : `Loaded ${r.customers} sailors`);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [syncStep, setSyncStep] = useState<string | null>(null);
  const syncAllMut = useMutation({
    mutationFn: async () => {
      const summary: Record<string, string> = {};
      // Shopify (paginated loop)
      setSyncStep("shopify");
      let s: any = await shopifyFn({ data: {} });
      while (s?.ok && !s.done) {
        s = await shopifyFn({
          data: {
            nextCustomersPath: s.nextCustomersPath,
            nextOrdersPath: s.nextOrdersPath,
            productCount: s.productCount,
            customersSynced: s.customersSynced,
            ordersSynced: s.ordersSynced,
          },
        });
      }
      summary.shopify = s?.message ?? "done";
      // Klaviyo / Facebook / Circle in parallel (they match by email into customers)
      setSyncStep("klaviyo · facebook · circle");
      const [k, f, c] = await Promise.allSettled([klaviyoFn({}), facebookFn({}), circleFn({})]);
      summary.klaviyo = k.status === "fulfilled" ? (k.value as any).message : (k.reason?.message ?? "failed");
      summary.facebook = f.status === "fulfilled" ? (f.value as any).message : (f.reason?.message ?? "failed");
      summary.circle = c.status === "fulfilled" ? (c.value as any).message : (c.reason?.message ?? "failed");
      // Recompute LTV / RFM / recommendations / actions from real data
      setSyncStep("rebuilding fleet intelligence");
      const r = await refreshFn({});
      summary.fleet = `${r.customers} customers · ${r.rfm} RFM · ${r.recommendations} recs · ${r.actions} actions`;
      return summary;
    },
    onSuccess: (summary) => {
      toast.success("Fleet unified by email across all sources");
      Object.entries(summary).forEach(([k, v]) => toast.message(`${k}: ${v}`));
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message?.slice(0, 200) ?? "Sync failed"),
    onSettled: () => setSyncStep(null),
  });

  const refreshMut = useMutation({
    mutationFn: () => refreshFn({}),
    onSuccess: (r) => {
      toast.success(`Fleet updated · ${r.customers} customers · ${r.rfm} RFM · ${r.recommendations} recommendations`);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message?.slice(0, 200) ?? "Update failed"),
  });

  const empty = !isLoading && data && data.kpi.totalCustomers === 0;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-primary tracking-widest">THE BRIDGE</p>
          <h1 className="text-3xl font-semibold mt-1">Good seas ahead</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your fleet at a glance — signal strength, opportunities, and pending actions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => syncAllMut.mutate()}
            disabled={syncAllMut.isPending}
            className="bg-primary text-primary-foreground"
          >
            <Zap className={`size-4 mr-2 ${syncAllMut.isPending ? "animate-pulse" : ""}`} />
            {syncAllMut.isPending ? `Syncing ${syncStep ?? "…"}` : "Sync all sources"}
          </Button>
          <Button
            onClick={() => qc.invalidateQueries()}
            variant="outline"
            disabled={isFetching || syncAllMut.isPending}
          >
            <RefreshCw className={`size-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => seedMut.mutate()} disabled={seedMut.isPending} variant="ghost">
            <Database className="size-4 mr-2" />
            {seedMut.isPending ? "Loading…" : "Sample fleet"}
          </Button>
        </div>
      </div>


      {empty && (
        <div className="glow-card p-12 text-center space-y-4">
          <Sparkles className="size-12 text-primary mx-auto" />
          <h2 className="text-xl font-semibold">Cast off with sample data</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Generate 200 mock sailors with realistic orders, email engagement, and ad spend — all wired through the intelligence engine.
          </p>
          <Button onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
            <Database className="size-4 mr-2" /> Launch demo voyage
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Fleet size" value={data?.kpi.totalCustomers ?? 0} icon={Users} hint="sailors" />
        <Kpi label="Avg lifetime value" value={`€${data?.kpi.avgLtv ?? 0}`} icon={DollarSign} hint="per customer" />
        <Kpi label="Champions" value={data?.kpi.champion ?? 0} icon={Crown} hint="top-tier" tone="amber" />
        <Kpi label="At risk" value={data?.kpi.atRisk ?? 0} icon={AlertTriangle} hint="needs attention" tone="coral" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glow-card p-6 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Signal strength by tier</h3>
              <p className="text-xs text-muted-foreground">RFM segmentation across the fleet</p>
            </div>
            <Link to="/harbor" className="text-xs text-primary hover:underline">All segments →</Link>
          </div>
          <div className="space-y-2">
            {Object.entries(data?.tierCounts ?? {}).sort((a, b) => b[1] - a[1]).map(([tier, count]) => {
              const pct = data?.kpi.totalCustomers ? (count / data.kpi.totalCustomers) * 100 : 0;
              return (
                <div key={tier} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className={`px-2 py-0.5 rounded border ${TIER_COLORS[tier] ?? ""}`}>{tier}</span>
                    <span className="font-mono text-muted-foreground">{count} · {pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-primary/40 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glow-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-emerald-400" />
            <h3 className="font-semibold">Opportunity</h3>
          </div>
          <p className="text-4xl font-mono text-emerald-400">{formatEuro(data?.kpi.opportunity ?? 0)}</p>
          <p className="text-xs text-muted-foreground">
            Expected revenue across {data?.kpi.pendingActions ?? 0} pending action{(data?.kpi.pendingActions ?? 0) === 1 ? "" : "s"}.
          </p>
          <Link to="/queue">
            <Button className="w-full" variant="outline">
              Open action queue <ArrowRight className="size-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>

      {data && data.kpi.totalCustomers > 0 && (
        <ClaudeActionsFeed
          cacheKey={`dashboard:${data.kpi.totalCustomers}:${data.kpi.atRisk}:${data.kpi.champion}`}
          snapshot={{
            season: new Date().toLocaleString("en-US", { month: "long" }),
            total_customers: data.kpi.totalCustomers,
            avg_ltv: data.kpi.avgLtv,
            champions: data.kpi.champion,
            at_risk: data.kpi.atRisk,
            opportunity_eur: data.kpi.opportunity,
            pending_actions: data.kpi.pendingActions,
            tier_counts: data.tierCounts,
            top_products: (data.topRecs ?? []).slice(0, 6).map((r: any) => r.product_name),
          }}
        />
      )}

      <div className="glow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Top recommendations</h3>
          <span className="text-xs text-muted-foreground font-mono">{data?.topRecs.length ?? 0} ready</span>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {(data?.topRecs ?? []).slice(0, 6).map((r: any) => (
            <Link
              key={r.id}
              to="/customer/$id"
              params={{ id: r.customer_id }}
              className="flex items-center gap-3 p-3 rounded-md bg-surface-2/50 border border-border hover:border-primary/40 transition-all hover:translate-x-0.5"
            >
              <div className="text-2xl">{r.product_image}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{r.product_name}</p>
                <p className="text-xs text-muted-foreground truncate">{r.reason}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-primary text-sm">{r.confidence}%</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{r.channel}</p>
              </div>
            </Link>
          ))}
          {(!data?.topRecs || data.topRecs.length === 0) && (
            <p className="text-sm text-muted-foreground col-span-2 text-center py-8">
              Load sample data to see recommendations.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, hint, tone }: { label: string; value: any; icon: any; hint: string; tone?: "amber" | "coral" }) {
  const color = tone === "amber" ? "text-amber-400" : tone === "coral" ? "text-orange-400" : "text-primary";
  return (
    <div className="glow-card p-5 space-y-2 hover:translate-y-[-2px] transition-transform">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className={`size-4 ${color}`} />
      </div>
      <p className={`text-3xl font-mono ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
