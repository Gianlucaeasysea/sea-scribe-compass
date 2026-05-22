import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCustomerProfile } from "@/lib/queries.functions";
import { ArrowLeft, Mail, MapPin, Anchor, MessageCircle, TrendingDown, ShoppingBag } from "lucide-react";
import { formatDate, formatEuro } from "@/lib/format";
import { ClaudeCustomerInsights } from "@/components/ai/claude-customer-insights";

export const Route = createFileRoute("/_authenticated/customer/$id")({
  component: CustomerProfile,
});

function CustomerProfile() {
  const { id } = useParams({ from: "/_authenticated/customer/$id" });
  const fetch = useServerFn(getCustomerProfile);
  const { data, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetch({ data: { id } }),
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Charting course…</div>;
  if (!data?.customer) return <div className="p-8 text-muted-foreground">Sailor not found.</div>;

  const c = data.customer;
  const opens = data.emails.filter((e: any) => e.event_type === "opened").length;
  const sent = data.emails.length;
  const openRate = sent ? Math.round((opens / sent) * 100) : 0;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <Link to="/map" className="inline-flex items-center text-xs text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-3 mr-1" /> Back to Honeycomb
      </Link>

      <div className="glow-card p-6 flex items-start gap-6">
        <div className="size-20 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 grid place-items-center text-3xl font-mono text-primary border border-primary/40">
          {c.name?.[0] ?? "?"}
        </div>
        <div className="flex-1 space-y-1">
          <h1 className="text-2xl font-semibold">{c.name}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="size-3" /> {c.email}</p>
          <p className="text-sm text-muted-foreground flex items-center gap-2"><MapPin className="size-3" /> {c.city}, {c.country}</p>
          {c.boat_type && <p className="text-sm text-muted-foreground flex items-center gap-2"><Anchor className="size-3" /> {c.boat_type}</p>}
          <div className="flex gap-2 mt-2">
            {(c.tags ?? []).map((t: string) => (
              <span key={t} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">{t}</span>
            ))}
          </div>
        </div>
        <div className="text-right space-y-3">
          {data.rfm && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Tier</p>
              <p className="text-xl font-semibold text-primary">{data.rfm.tier}</p>
              <p className="font-mono text-xs text-muted-foreground">RFM {data.rfm.recency_score}{data.rfm.frequency_score}{data.rfm.monetary_score}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Lifetime value" value={formatEuro(Math.round(c.lifetime_value))} />
        <Stat label="Orders" value={c.total_orders} icon={ShoppingBag} />
        <Stat label="Email open rate" value={`${openRate}%`} icon={Mail} />
        <Stat label="Churn risk" value={`${data.rfm?.churn_risk ?? 0}%`} icon={TrendingDown} tone={data.rfm && data.rfm.churn_risk > 60 ? "coral" : undefined} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glow-card p-5 lg:col-span-2 space-y-3">
          <h3 className="font-semibold">Order history</h3>
          {data.orders.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
          <div className="space-y-2 max-h-[420px] overflow-auto pr-2">
            {data.orders.map((o: any) => (
              <div key={o.id} className="flex items-center gap-3 p-3 rounded-md bg-surface-2/40 border border-border">
                <div className="flex-1 min-w-0">
                  <div className="flex gap-1 text-xl">
                    {(Array.isArray(o.line_items) ? o.line_items : []).map((it: any, i: number) => (
                      <span key={i} title={it.name}>{it.image}</span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(o.created_at)} · {(Array.isArray(o.line_items) ? o.line_items : []).map((it: any) => it.name).join(", ")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-primary">€{Math.round(o.total)}</p>
                  {o.discount_used && <p className="text-[10px] text-amber-400 uppercase tracking-wide">Discount</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glow-card p-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><MessageCircle className="size-4 text-primary" /> Community signal</h3>
            {data.circle ? (
              <>
                <p className="text-3xl font-mono text-primary">{data.circle.engagement_score}</p>
                <p className="text-xs text-muted-foreground">
                  {data.circle.posts} posts · {data.circle.comments} comments · {data.circle.reactions} reactions
                </p>
                <div className="flex gap-1 flex-wrap">
                  {(data.circle.badges ?? []).map((b: string) => (
                    <span key={b} className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">{b}</span>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Not in Circle community.</p>
            )}
          </div>

          <div className="glow-card p-5 space-y-3">
            <h3 className="font-semibold">Next-best actions</h3>
            {data.recs.length === 0 && <p className="text-xs text-muted-foreground">No recommendations.</p>}
            {data.recs.map((r: any) => (
              <div key={r.id} className="p-3 rounded-md bg-surface-2/40 border border-border space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{r.product_image}</span>
                  <span className="flex-1 text-sm">{r.product_name}</span>
                  <span className="font-mono text-primary text-xs">{r.confidence}%</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{r.reason}</p>
                <p className="text-[11px] text-primary">{r.channel} · {r.best_send}</p>
                <p className="text-[11px] italic text-muted-foreground">"{r.angle}"</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: any; icon?: any; tone?: "coral" }) {
  const color = tone === "coral" ? "text-orange-400" : "text-foreground";
  return (
    <div className="glow-card p-4 space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        {Icon && <Icon className="size-3.5 text-muted-foreground" />}
      </div>
      <p className={`text-2xl font-mono ${color}`}>{value}</p>
    </div>
  );
}
