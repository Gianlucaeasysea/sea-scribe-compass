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
import { tierIT } from "@/lib/i18n";
import { ClaudeActionsFeed } from "@/components/ai/claude-actions-feed";
import { CountUp } from "@/components/ui/count-up";
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
      toast.success(r?.skipped ? "Dati demo già caricati" : `Caricati ${r.customers} clienti`);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [syncStep, setSyncStep] = useState<string | null>(null);
  const syncAllMut = useMutation({
    mutationFn: async () => {
      const summary: Record<string, string> = {};
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
      summary.shopify = s?.message ?? "fatto";
      setSyncStep("klaviyo · facebook · circle");
      const [k, f, c] = await Promise.allSettled([klaviyoFn({}), facebookFn({}), circleFn({})]);
      summary.klaviyo = k.status === "fulfilled" ? (k.value as any).message : (k.reason?.message ?? "errore");
      summary.facebook = f.status === "fulfilled" ? (f.value as any).message : (f.reason?.message ?? "errore");
      summary.circle = c.status === "fulfilled" ? (c.value as any).message : (c.reason?.message ?? "errore");
      setSyncStep("aggiornamento intelligence clienti");
      const r = await refreshFn({});
      summary.fleet = `${r.customers} clienti · ${r.rfm} RFM · ${r.recommendations} raccomandazioni · ${r.actions} azioni`;
      return summary;
    },
    onSuccess: (summary) => {
      toast.success("Clienti unificati tramite email da tutte le sorgenti");
      Object.entries(summary).forEach(([k, v]) => toast.message(`${k}: ${v}`));
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message?.slice(0, 200) ?? "Sincronizzazione fallita"),
    onSettled: () => setSyncStep(null),
  });

  const refreshMut = useMutation({
    mutationFn: () => refreshFn({}),
    onSuccess: (r) => {
      toast.success(`Aggiornato · ${r.customers} clienti · ${r.rfm} RFM · ${r.recommendations} raccomandazioni`);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message?.slice(0, 200) ?? "Aggiornamento fallito"),
  });

  const empty = !isLoading && data && data.kpi.totalCustomers === 0;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-primary tracking-widest">PANORAMICA</p>
          <h1 className="text-3xl font-semibold mt-1">Panoramica</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Il cuore operativo del tuo marketing nautico.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => syncAllMut.mutate()}
            disabled={syncAllMut.isPending}
            className="bg-primary text-primary-foreground"
          >
            <Zap className={`size-4 mr-2 ${syncAllMut.isPending ? "animate-pulse" : ""}`} />
            {syncAllMut.isPending ? `Sincronizzazione ${syncStep ?? "…"}` : "Sincronizza tutto"}
          </Button>
          <Button
            onClick={() => refreshMut.mutate()}
            disabled={refreshMut.isPending || syncAllMut.isPending}
            variant="outline"
          >
            <Sparkles className={`size-4 mr-2 ${refreshMut.isPending ? "animate-pulse" : ""}`} />
            {refreshMut.isPending ? "Aggiornamento…" : "Aggiorna dati"}
          </Button>
          <Button
            onClick={() => qc.invalidateQueries()}
            variant="outline"
            disabled={isFetching || syncAllMut.isPending}
          >
            <RefreshCw className={`size-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Ricarica
          </Button>
          <Button onClick={() => seedMut.mutate()} disabled={seedMut.isPending} variant="ghost">
            <Database className="size-4 mr-2" />
            {seedMut.isPending ? "Caricamento…" : "Dati demo"}
          </Button>
        </div>
      </div>


      {empty && (
        <div className="glow-card p-12 text-center space-y-4">
          <Sparkles className="size-12 text-primary mx-auto" />
          <h2 className="text-xl font-semibold">Inizia con i dati demo</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Genera 200 clienti di esempio con ordini realistici, engagement email e spesa pubblicitaria — tutto collegato al motore di intelligence.
          </p>
          <Button onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
            <Database className="size-4 mr-2" /> Carica dati demo
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Clienti totali" numericValue={data?.kpi.totalCustomers ?? 0} icon={Users} hint="diportisti" />
        <Kpi label="Valore medio" numericValue={data?.kpi.avgLtv ?? 0} prefix="€" icon={DollarSign} hint="per cliente pagante" />
        <Kpi label="Clienti top" numericValue={data?.kpi.champion ?? 0} icon={Crown} hint="champion + loyali" tone="amber" />
        <Kpi label="A rischio abbandono" numericValue={data?.kpi.atRisk ?? 0} icon={AlertTriangle} hint="riattivazione urgente" tone="coral" />
      </div>


      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glow-card p-6 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Performance segmenti</h3>
              <p className="text-xs text-muted-foreground">Distribuzione RFM dei clienti</p>
            </div>
            <Link to="/harbor" className="text-xs text-primary hover:underline">Tutti i segmenti →</Link>
          </div>
          <div className="space-y-2">
            {Object.entries(data?.tierCounts ?? {}).sort((a, b) => b[1] - a[1]).map(([tier, count]) => {
              const pct = data?.kpi.totalCustomers ? (count / data.kpi.totalCustomers) * 100 : 0;
              return (
                <div key={tier} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className={`px-2 py-0.5 rounded border ${TIER_COLORS[tier] ?? ""}`}>{tierIT(tier)}</span>
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
            <h3 className="font-semibold">Opportunità</h3>
          </div>
          <p className="text-4xl font-mono text-emerald-400">{formatEuro(data?.kpi.opportunity ?? 0)}</p>
          <p className="text-xs text-muted-foreground">
            Ricavi attesi su {data?.kpi.pendingActions ?? 0} azion{(data?.kpi.pendingActions ?? 0) === 1 ? "e" : "i"} in sospeso.
          </p>
          <Link to="/queue">
            <Button className="w-full" variant="outline">
              Apri coda azioni <ArrowRight className="size-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>

      {data && data.kpi.totalCustomers > 0 && (
        <ClaudeActionsFeed
          cacheKey={`dashboard:${data.kpi.totalCustomers}:${data.kpi.atRisk}:${data.kpi.champion}`}
          snapshot={{
            season: new Date().toLocaleString("it-IT", { month: "long" }),
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
          <h3 className="font-semibold">Azioni di oggi</h3>
          <span className="text-xs text-muted-foreground font-mono">{data?.topRecs.length ?? 0} pronte</span>
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
              Carica i dati demo per vedere le raccomandazioni.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, numericValue, prefix, icon: Icon, hint, tone, trend, spark }: { label: string; numericValue: number; prefix?: string; icon: any; hint: string; tone?: "amber" | "coral"; trend?: number; spark?: number[] }) {
  const color = tone === "amber" ? "text-amber-400" : tone === "coral" ? "text-orange-400" : "text-primary";
  const points = spark ?? (() => {
    const seed = [...label].reduce((s, c) => s + c.charCodeAt(0), 0);
    return Array.from({ length: 12 }, (_, i) => 0.3 + 0.5 * Math.abs(Math.sin(seed * 0.13 + i * 0.7)));
  })();
  const max = Math.max(...points, 0.01);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i / (points.length - 1)) * 100} ${30 - (p / max) * 26}`)
    .join(" ");
  const arrow = trend == null ? null : trend >= 0 ? "▲" : "▼";
  const trendColor = trend == null ? "" : trend >= 0 ? "text-emerald-400" : "text-orange-400";
  return (
    <div className="glow-card lift p-5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className={`size-4 ${color}`} />
      </div>
      <p className={`text-3xl font-mono ${color}`}>
        <CountUp value={numericValue} prefix={prefix ?? ""} />
      </p>
      <div className="flex items-end justify-between gap-2">
        <p className="text-xs text-muted-foreground">{hint}</p>
        <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-20 h-7 opacity-70">
          <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" className={color} />
        </svg>
      </div>
      {arrow && (
        <p className={`text-[11px] font-mono ${trendColor}`}>
          {arrow} {Math.abs(trend!).toFixed(0)}% vs mese scorso
        </p>
      )}
    </div>
  );
}


